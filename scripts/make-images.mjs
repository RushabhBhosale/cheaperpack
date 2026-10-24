// Generates public/og.png (social share image) and public/apple-touch-icon.png.
// Run `npm run images` after changing the site name below; the PNGs are committed.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const NAME = process.env.SITE_NAME ?? 'Recall Radar';
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const font = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const mark = (cx, cy, r) => `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#b42318"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="#fff" stroke-width="${r * 0.14}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="#fff"/>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect width="1200" height="14" fill="#b42318"/>
  ${mark(140, 150, 50)}
  <text x="215" y="168" font-family="${font}" font-size="52" font-weight="800" fill="#16181d">${NAME}</text>
  <text x="80" y="330" font-family="${font}" font-size="84" font-weight="800" fill="#16181d" letter-spacing="-2">Is your product</text>
  <text x="80" y="425" font-family="${font}" font-size="84" font-weight="800" fill="#b42318" letter-spacing="-2">recalled?</text>
  <text x="80" y="510" font-family="${font}" font-size="34" fill="#3b414c">Search US consumer product recalls, updated daily.</text>
  <text x="80" y="570" font-family="${font}" font-size="26" fill="#626a78">Official CPSC data · hazards · remedies</text>
</svg>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="#ffffff"/>${mark(90, 90, 70)}</svg>`;

await sharp(Buffer.from(og)).png().toFile(out('og.png'));
await sharp(Buffer.from(icon)).png().toFile(out('apple-touch-icon.png'));
console.log('Wrote public/og.png and public/apple-touch-icon.png');
