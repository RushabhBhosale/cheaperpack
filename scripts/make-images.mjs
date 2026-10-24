// Generates public/og.png (social sharing image) and public/apple-touch-icon.png.
// Run with `npm run og` after changing the artwork; the PNGs are committed.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const font = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const mark = (x, y, s) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect width="32" height="32" rx="8" fill="#111827"/>
    <rect x="6" y="15" width="8" height="10" rx="1.5" fill="none" stroke="#fff" stroke-width="2"/>
    <rect x="16" y="9" width="10" height="16" rx="1.5" fill="#fff"/>
    <path d="M18.6 17.2l2 2 3.4-4" fill="none" stroke="#111827" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

const chipWidth = (label) => Math.round(label.length * 14.2 + 48);
const chips = (labels) => {
  let x = 80;
  return labels
    .map((label) => {
      const w = chipWidth(label);
      const out = `<rect x="${x}" y="470" width="${w}" height="56" rx="28" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
  <text x="${x + 24}" y="507" font-family="${font}" font-size="26" fill="#374151">${label.replace('&', '&amp;')}</text>`;
      x += w + 16;
      return out;
    })
    .join('');
};

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  ${mark(80, 80, 2.2)}
  <text x="168" y="125" font-family="${font}" font-size="40" font-weight="700" fill="#111827">CheaperPack</text>
  <text x="80" y="285" font-family="${font}" font-size="80" font-weight="800" fill="#111827" letter-spacing="-1.5">Spend smarter. Save more.</text>
  <text x="80" y="360" font-family="${font}" font-size="34" fill="#6b7280">Free tools to compare prices and calculate real savings.</text>
  ${chips(['Price per kg', 'Deals & cashback', 'EMI vs cash', 'Receipts'])}
</svg>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#111827"/>
  ${mark(0, 0, 1).replace('rx="8"', 'rx="0"')}
</svg>`;

await sharp(Buffer.from(og)).png().toFile(out('og.png'));
await sharp(Buffer.from(icon)).png().toFile(out('apple-touch-icon.png'));
console.log('Wrote public/og.png and public/apple-touch-icon.png');
