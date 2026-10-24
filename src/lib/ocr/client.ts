/**
 * Browser-side OCR, shared by the price-tag scanner and the receipt analyzer.
 * The engine (OpenCV.js, ONNX Runtime, PaddleOCR models, about 13 MB) runs in
 * a Web Worker and is only downloaded the first time it's needed. Images
 * never leave the device.
 */

import type { EngineLine, RecogniseOptions } from './engine';
import type { FromWorker, ToWorker } from './worker';

export type { EngineLine };
export type OcrStep = { phase: 'engine' | 'models' | 'reading'; fraction: number | null };
export type OcrErrorCode = 'unsupported' | 'image' | 'engine' | 'offline' | 'scan';

export class OcrError extends Error {
  constructor(
    public code: OcrErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function ocrSupported(): boolean {
  return typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function';
}

/** Data saver on, or a 2G connection: don't start a 13 MB download unasked. */
export function slowConnection(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.effectiveType === '2g' || c.effectiveType === 'slow-2g');
}

let worker: Worker | null = null;
let ready = false;
let failed = false;
let nextId = 0;
let progressFn: ((s: OcrStep) => void) | null = null;
const pending = new Map<number, { resolve: (lines: EngineLine[]) => void; reject: (e: OcrError) => void }>();

export const engineReady = () => ready;
export const engineFailed = () => failed;

function rejectAll(err: OcrError) {
  for (const p of pending.values()) p.reject(err);
  pending.clear();
}

function onMessage(msg: FromWorker) {
  switch (msg.type) {
    case 'progress':
      if (!ready) progressFn?.({ phase: msg.phase, fraction: msg.phase === 'engine' ? null : msg.fraction });
      break;
    case 'ready':
      ready = true;
      if (pending.size) progressFn?.({ phase: 'reading', fraction: null });
      break;
    case 'result':
      pending.get(msg.id)?.resolve(msg.lines);
      pending.delete(msg.id);
      break;
    case 'error':
      if (msg.stage === 'init') {
        failed = true;
        worker?.terminate();
        worker = null;
        rejectAll(navigator.onLine ? new OcrError('engine', msg.message) : new OcrError('offline', msg.message));
      } else if (msg.id !== undefined) {
        pending.get(msg.id)?.reject(new OcrError('scan', msg.message));
        pending.delete(msg.id);
      }
      break;
  }
}

/** Starts downloading and preparing the engine in the background. */
export function warmUp(onProgress?: (s: OcrStep) => void) {
  if (onProgress) progressFn = onProgress;
  if (worker || !ocrSupported()) return;
  failed = false;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'cheaperpack-ocr' });
  worker.onmessage = (e: MessageEvent<FromWorker>) => onMessage(e.data);
  worker.onerror = () => {
    failed = true;
    worker?.terminate();
    worker = null;
    rejectAll(new OcrError('engine', 'The OCR worker could not start.'));
  };
  worker.postMessage({ type: 'init' } satisfies ToWorker);
}

/** Decodes a photo (respecting its rotation) and scales it so the longest side is at most maxSide. */
async function prepare(file: Blob, maxSide: number): Promise<ImageBitmap> {
  const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  if (scale === 1) return source;
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  source.close();
  return canvas.transferToImageBitmap();
}

export interface RecognizeOptions extends RecogniseOptions {
  /** Longest side the photo is scaled to before reading. */
  maxSide?: number;
  onProgress?: (s: OcrStep) => void;
}

/** Reads the text in an image. Rejects with an OcrError the caller can explain. */
export async function recognize(file: Blob, opts: RecognizeOptions = {}): Promise<EngineLine[]> {
  if (!ocrSupported()) throw new OcrError('unsupported', 'OCR is not supported in this browser.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await prepare(file, opts.maxSide ?? 1600);
  } catch {
    throw new OcrError('image', 'The image could not be opened.');
  }
  if (opts.onProgress) progressFn = opts.onProgress;
  warmUp();
  if (!worker) {
    bitmap.close();
    throw new OcrError(failed ? 'engine' : 'unsupported', 'The OCR engine is not available.');
  }
  const id = ++nextId;
  progressFn?.(ready ? { phase: 'reading', fraction: null } : { phase: 'engine', fraction: null });
  return new Promise<EngineLine[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ type: 'scan', id, bitmap, options: { detLimitSideLen: opts.detLimitSideLen, detLimitType: opts.detLimitType } } satisfies ToWorker, [bitmap]);
  });
}

/** Stops waiting for a scan (the engine keeps running for next time). */
export function cancelPending() {
  rejectAll(new OcrError('scan', 'Cancelled'));
}
