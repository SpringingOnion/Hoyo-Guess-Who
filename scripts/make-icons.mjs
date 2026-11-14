// Generates the app icons in public/. Run: node scripts/make-icons.mjs
import sharp from 'sharp';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#14121c"/>
  <circle cx="256" cy="256" r="170" fill="#2a2639"/>
  <path d="M256 86 A170 170 0 0 1 403 341 L256 256Z" fill="#e3c27d"/>
  <path d="M403 341 A170 170 0 0 1 109 341 L256 256Z" fill="#b49cff"/>
  <path d="M109 341 A170 170 0 0 1 256 86 L256 256Z" fill="#c8f23a"/>
  <circle cx="256" cy="256" r="118" fill="#14121c"/>
  <text x="256" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="150" fill="#f2eff8">?</text>
</svg>`;
for (const s of [192, 512]) await sharp(Buffer.from(svg)).resize(s, s).png().toFile(`public/icon-${s}.png`);
