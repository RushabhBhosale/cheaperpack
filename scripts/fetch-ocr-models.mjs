// Downloads the PaddleOCR PP-OCRv6 tiny models (Apache-2.0) into
// src/assets/ocr/ and verifies their checksums. The files are part of the
// project, so you only need this to restore or re-verify them:
//   npm run ocr:models
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/';
const MODELS = {
  'PP-OCRv6_tiny_det.tar': { remote: 'PP-OCRv6_tiny_det_onnx_infer.tar', sha256: 'ff6ab415b0a6e0c488550f2fb5d5046f1719848df220b2dc21b56402a65bc05d' },
  'PP-OCRv6_tiny_rec.tar': { remote: 'PP-OCRv6_tiny_rec_onnx_infer.tar', sha256: '1e13b22717b1edd89d4cde4fda272b6c17d5b505c97c2baea99da1a3a2d54b29' },
};

const dir = fileURLToPath(new URL('../src/assets/ocr/', import.meta.url));
await mkdir(dir, { recursive: true });
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

for (const [name, { remote, sha256 }] of Object.entries(MODELS)) {
  const path = dir + name;
  if (existsSync(path) && sha(await readFile(path)) === sha256) {
    console.log(`ok       ${name}`);
    continue;
  }
  const res = await fetch(BASE + remote);
  if (!res.ok) throw new Error(`Download failed for ${remote}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha(buf) !== sha256) throw new Error(`Checksum mismatch for ${remote}; not saving it.`);
  await writeFile(path, buf);
  console.log(`fetched  ${name} (${(buf.length / 1e6).toFixed(1)} MB)`);
}
