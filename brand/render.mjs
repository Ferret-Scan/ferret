// FERRET brand kit: logo.svg, avatar.png, small48.png, x-header.png here, plus logo.png and
// og-image.png in ../site. node render.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const sharp = createRequire(import.meta.url)('../../mole/worker/node_modules/sharp');

const G = '#0f4a36', C = '#f7f6ee', O = '#f2501c', INK = '#13211a', BAR = '#dfeeda', MUTED = '#586a5f';
const file = (name) => fileURLToPath(new URL(name, import.meta.url));

// masked ferret, front view, long neck running off the bottom edge
const ferret = `
  <g fill="${C}">
    <circle cx="170" cy="126" r="35"/><circle cx="342" cy="126" r="35"/>
    <path d="M256 78c-84 0-134 52-134 116 0 44 26 78 58 100-12 60-22 130-22 230h196c0-100-10-170-22-230 32-22 58-56 58-100 0-64-50-116-134-116z"/>
  </g>
  <path d="M128 170c40-22 84-14 128 12 44-26 88-34 128-12-6 44-40 66-78 62-22-2-38-12-50-28-12 16-28 26-50 28-38 4-72-18-78-62z" fill="${G}"/>
  <circle cx="196" cy="196" r="14" fill="${C}"/><circle cx="316" cy="196" r="14" fill="${C}"/>
  <path d="M226 262h60l-30 34z" fill="${O}"/>`;
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${G}"/>${ferret}</svg>`;
writeFileSync(file('./logo.svg'), logo);
const png = (size) => sharp(Buffer.from(logo)).resize(size, size).png().toBuffer();
writeFileSync(file('./avatar.png'), await png(800));
writeFileSync(file('./small48.png'), await png(48));
writeFileSync(file('../site/logo.png'), await png(256));

const HEAD = 'font-family="Arial Black, Arial, sans-serif" font-weight="900"';
const MONO = 'font-family="Consolas, Courier New, monospace"';
const holes = (h, x = 28) => Array.from({ length: Math.ceil(h / 44) }, (_, i) => `<circle cx="${x}" cy="${22 + i * 44}" r="9" fill="${C}"/>`).join('');
const rows = [['FORM 4', 'CEO bought his own stock', G], ['13F', 'Fund opened a new position', O], ['FORM 4', 'Director bought on the dip', G]];
const printout = (x, y, w) => `<g transform="translate(${x} ${y})">
  <rect width="${w}" height="${rows.length * 54}" fill="#fffffb" stroke="${INK}" stroke-width="3"/>
  ${rows.map(([src, text, c], i) => `
    ${i % 2 ? '' : `<rect x="1.5" y="${i * 54 + 1.5}" width="${w - 3}" height="${i === rows.length - 1 ? 51 : 54}" fill="${BAR}"/>`}
    <text x="20" y="${i * 54 + 34}" ${MONO} font-weight="700" font-size="18" fill="${c}">${src}</text>
    <text x="112" y="${i * 54 + 34}" font-family="Arial, sans-serif" font-weight="700" font-size="20" fill="${INK}">${text}</text>
    <text x="${w - 20}" y="${i * 54 + 34}" text-anchor="end" ${MONO} font-size="16" fill="${MUTED}">has a token</text>`).join('')}
</g>`;
const circle = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${O}" stroke-width="7" transform="rotate(-2 ${cx} ${cy})"/>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${C}"/>
  <rect width="56" height="630" fill="${G}"/>${holes(630)}
  <text x="104" y="92" ${MONO} font-size="22" fill="${MUTED}">SEC FILINGS &#8594; STOCK TOKENS ON ROBINHOOD CHAIN</text>
  <g ${HEAD} fill="${INK}" font-size="76" letter-spacing="-2">
    <text x="100" y="196">Nobody reads</text>
    <text x="100" y="280">the filings.</text>
    <text x="100" y="380">The ferret does.</text>
  </g>
  ${circle(440, 354, 362, 58)}
  ${printout(104, 434, 690)}
  <svg x="860" y="150" width="340" height="480" viewBox="86 40 340 480"><rect x="86" y="40" width="340" height="480" fill="${C}"/><g transform="translate(0 0)">${ferret.replaceAll(C, '#TMP').replaceAll(G, C).replaceAll('#TMP', G)}</g></svg>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(file('../site/og-image.png'));

const header = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500">
  <rect width="1500" height="500" fill="${G}"/>
  ${holes(500, 30)}${holes(500, 1470)}
  <g ${HEAD} fill="${C}" font-size="64" letter-spacing="-1.5">
    <text x="470" y="170">Nobody reads the filings.</text>
    <text x="470" y="254">The ferret does.</text>
  </g>
  ${circle(755, 232, 300, 50)}
  <text x="472" y="330" ${MONO} font-size="24" fill="${BAR}">SEC filings, matched to stock tokens on Robinhood Chain</text>
</svg>`;
await sharp(Buffer.from(header)).png().toFile(file('./x-header.png'));
console.log('wrote logo.svg, avatar.png, small48.png, x-header.png, site/logo.png, site/og-image.png');
