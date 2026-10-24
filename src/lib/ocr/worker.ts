/// <reference lib="webworker" />
/**
 * OCR worker: downloads the engine on first use, then reads text from images
 * sent by the page. Images never leave the device.
 */

import type { Engine, EngineLine, RecogniseOptions } from './engine';

export type ToWorker = { type: 'init' } | { type: 'scan'; id: number; bitmap: ImageBitmap; options?: RecogniseOptions };
export type FromWorker =
  | { type: 'progress'; phase: 'engine' | 'models'; fraction: number }
  | { type: 'ready'; backend: string; threads: number; ms: number }
  | { type: 'result'; id: number; lines: EngineLine[]; ms: number }
  | { type: 'error'; stage: 'init' | 'scan'; id?: number; message: string };

declare const self: DedicatedWorkerGlobalScope;
const post = (msg: FromWorker) => self.postMessage(msg);

// Uncompressed sizes of what the engine fetches: ONNX Runtime WASM + models.
const EXPECTED_BYTES = 14_239_897 + 1_792_000 + 4_526_080;
let loadedBytes = 0;

// Count bytes of every download the engine makes, for a real progress bar.
const nativeFetch = self.fetch.bind(self);
self.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await nativeFetch(input, init);
  if (!res.ok || !res.body) return res;
  const reader = res.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      loadedBytes += value.byteLength;
      post({ type: 'progress', phase: 'models', fraction: Math.min(0.99, loadedBytes / EXPECTED_BYTES) });
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(stream, { status: res.status, statusText: res.statusText, headers });
};

let enginePromise: Promise<Engine> | null = null;
let threads = 1;

function init(): Promise<Engine> {
  if (!enginePromise) {
    const started = performance.now();
    // Threads only work when the page is cross-origin isolated (see _headers).
    threads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1;
    post({ type: 'progress', phase: 'engine', fraction: 0 });
    enginePromise = import('./engine')
      .then((m) => {
        post({ type: 'progress', phase: 'models', fraction: loadedBytes / EXPECTED_BYTES });
        return m.createEngine(threads);
      })
      .then((engine) => {
        post({ type: 'ready', backend: engine.backend, threads, ms: Math.round(performance.now() - started) });
        return engine;
      })
      .catch((err: unknown) => {
        enginePromise = null;
        loadedBytes = 0;
        throw err;
      });
  }
  return enginePromise;
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      await init();
    } catch (err) {
      post({ type: 'error', stage: 'init', message: String((err as Error)?.message ?? err) });
    }
    return;
  }
  if (msg.type === 'scan') {
    const started = performance.now();
    try {
      const engine = await init();
      const { recognise } = await import('./engine');
      const lines = await recognise(engine, msg.bitmap, msg.options);
      post({ type: 'result', id: msg.id, lines, ms: Math.round(performance.now() - started) });
    } catch (err) {
      msg.bitmap.close?.();
      post({ type: 'error', stage: 'scan', id: msg.id, message: String((err as Error)?.message ?? err) });
    }
  }
};
