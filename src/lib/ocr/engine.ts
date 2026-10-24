/**
 * OCR engine, loaded by the OCR worker with a dynamic import so none of this
 * (OpenCV.js, ONNX Runtime, models) is part of any page bundle.
 *
 * Uses the official PaddleOCR.js SDK in direct mode inside our own worker.
 * The SDK's built-in worker mode would also load OpenCV.js on the main thread,
 * doubling the download.
 */

import { PaddleOCR } from '@paddleocr/paddleocr-js';
import cvModule from '@techstark/opencv-js';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import detUrl from '../../assets/ocr/PP-OCRv6_tiny_det.tar?url';
import recUrl from '../../assets/ocr/PP-OCRv6_tiny_rec.tar?url';

export interface EngineLine {
  text: string;
  score: number;
  /** Bounding box in pixels of the image passed in. */
  x: number;
  y: number;
  w: number;
  height: number;
}

export interface RecogniseOptions {
  /** Detection resizes so this side limit applies (see PaddleOCR text_det_limit_side_len). */
  detLimitSideLen?: number;
  detLimitType?: 'min' | 'max';
}

type Ocr = Awaited<ReturnType<typeof PaddleOCR.create>>;
type Cv = { matFromImageData(data: ImageData): { delete(): void } };

export interface Engine {
  ocr: Ocr;
  cv: Cv;
  backend: string;
}

export async function createEngine(numThreads: number): Promise<Engine> {
  const ocr = await PaddleOCR.create({
    worker: false,
    textDetectionModelName: 'PP-OCRv6_tiny_det',
    textDetectionModelAsset: { url: detUrl },
    textRecognitionModelName: 'PP-OCRv6_tiny_rec',
    textRecognitionModelAsset: { url: recUrl },
    ortOptions: {
      // WebAssembly everywhere. WebGPU would need a further 28 MB runtime file,
      // larger than Cloudflare's 25 MiB per-file limit, for tiny models where
      // it isn't reliably faster on phones.
      backend: 'wasm',
      // ONNX Runtime accepts { wasm } here; the SDK passes it straight through.
      wasmPaths: { wasm: wasmUrl } as unknown as string,
      numThreads,
      simd: true,
    },
  });
  const mod = cvModule as unknown as Cv | Promise<Cv>;
  const cv = mod instanceof Promise ? await mod : mod;
  const summary = ocr.getInitializationSummary?.() as { backend?: string } | undefined;
  return { ocr, cv, backend: summary?.backend ?? 'wasm' };
}

/** Reads text lines from an image. The bitmap is closed afterwards. */
export async function recognise(engine: Engine, bitmap: ImageBitmap, opts: RecogniseOptions = {}): Promise<EngineLine[]> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No 2D canvas in worker');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const mat = engine.cv.matFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
  try {
    // The SDK accepts an OpenCV Mat directly, which avoids its DOM-only paths.
    const params: Record<string, unknown> = {};
    if (opts.detLimitSideLen) params.textDetLimitSideLen = opts.detLimitSideLen;
    if (opts.detLimitType) params.textDetLimitType = opts.detLimitType;
    const [result] = await engine.ocr.predict(mat as never, params as never);
    return (result?.items ?? []).map((item) => {
      const xs = item.poly.map((p) => (Array.isArray(p) ? p[0] : (p as { x: number }).x) as number);
      const ys = item.poly.map((p) => (Array.isArray(p) ? p[1] : (p as { y: number }).y) as number);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { text: item.text, score: item.score, x, y, w: Math.max(...xs) - x, height: Math.max(...ys) - y };
    });
  } finally {
    mat.delete();
    canvas.width = canvas.height = 0;
  }
}
