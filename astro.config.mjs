// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * The OCR engine runs the PaddleOCR.js SDK inside our own worker, so the
 * SDK's bundled worker (11 MB) is never used. Stop Vite from emitting it.
 * @returns {import('vite').Plugin}
 */
function dropPaddleOcrBuiltInWorker() {
  return {
    name: 'cheaperpack:drop-paddleocr-worker',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@paddleocr/paddleocr-js/dist/index.mjs')) return null;
      const next = code.replace(
        /new URL\("\.\/assets\/worker-entry-[\w-]+\.js", import\.meta\.url\)/,
        '(() => { throw new Error("PaddleOCR.js worker mode is not bundled; CheaperPack runs it in its own worker."); })()',
      );
      if (next === code) this.warn('PaddleOCR.js worker reference not found; the SDK may have changed.');
      return { code: next, map: null };
    },
  };
}

// Every page is pre-rendered to static HTML at build time. Cloudflare (Workers
// static assets or Pages) serves the `dist/` folder, so no server adapter is needed.
export default defineConfig({
  site: 'https://cheaperpack.com',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss(), dropPaddleOcrBuiltInWorker()],
    resolve: {
      // WebAssembly-only build of ONNX Runtime. The default build also pulls in
      // the 28 MB WebGPU runtime, which exceeds Cloudflare's 25 MiB file limit.
      alias: [{ find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/wasm' }],
    },
    worker: {
      // The OCR worker lazy-loads its engine with dynamic imports.
      format: 'es',
      plugins: () => [dropPaddleOcrBuiltInWorker()],
    },
  },
});
