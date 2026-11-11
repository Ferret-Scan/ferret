// The FERRET clip for X: a real Form 4, a real fund book, the wallet check. 1280x720, 30 fps, 23 seconds.
// SVG frames -> sharp -> ffmpeg (libx264). Colours and the ferret come from the site and logo.svg.
// The Form 4 and the fund book are read from ../site/data, so the clip shows what the site shows.
// The wallet result is an example and is labelled as one.
// Run: FFMPEG=<path to ffmpeg.exe> node demo.mjs  -> demo.mp4 next to this file.  ONLY=5,14 writes those seconds as PNGs.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const sharp = createRequire(import.meta.url)('../../mole/worker/node_modules/sharp');

const W = 1280, H = 720, FPS = 30;
const G = '#0f4a36', C = '#f7f6ee', O = '#f2501c', INK = '#13211a', BAR = '#dfeeda', MUTED = '#586a5f', LINE = '#b4ccb0', WHITE = '#fffffb';
const SLAB = 'Arial Black, Arial, sans-serif', SANS = 'Segoe UI, Arial, sans-serif', MONO = 'Consolas, monospace';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const span = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const typed = (text, t, a, b) => esc(text.slice(0, Math.floor(span(t, a, b) * text.length)));
const fade = (t, [a, b]) => Math.min(ease(span(t, a, a + 0.4)), 1 - ease(span(t, b - 0.35, b))).toFixed(2);
const usd = (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`);
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const data = (name) => JSON.parse(readFileSync(new URL(`../site/data/${name}.json`, import.meta.url), 'utf8'));
const trade = data('insiders').trades.filter((x) => x.type === 'buy').sort((a, b) => b.value - a.value).find((x) => x.symbol === 'INTC') || data('insiders').trades.find((x) => x.type === 'buy');
const fund = data('portfolios').portfolios.find((p) => p.id === 'tepper');
const rows = fund.holdings.slice(0, 6);
const quarter = `Q${Math.ceil(Number(fund.period.slice(5, 7)) / 3)} ${fund.period.slice(0, 4)}`;

// the ferret without its tile, and a recoloured one for light backgrounds
const art = readFileSync(new URL('./logo.svg', import.meta.url), 'utf8').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect[^>]*\/>/, '');
const dark = art.replaceAll(C, '#TMP').replaceAll(G, C).replaceAll('#TMP', G);
// a window the ferret rises into from below; k = 0 hidden, 1 fully up
const ferret = (x, y, size, k, paint = art) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 512 512"><g transform="translate(0 ${lerp(520, 0, ease(k)).toFixed(1)})">${paint}</g></svg>`;

const holes = (fill) => Array.from({ length: 17 }, (_, i) => `<circle cx="28" cy="${22 + i * 44}" r="9" fill="${fill}"/>`).join('');
const rail = `<rect width="56" height="${H}" fill="${G}"/>${holes(C)}`;
// marker circle that draws itself
function marker(cx, cy, rx, ry, k) {
  const len = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(len * ease(k)).toFixed(1)} ${len.toFixed(1)}" transform="rotate(-3 ${cx} ${cy})"/>`;
}
const kicker = (text, o) => `<g opacity="${o}"><rect x="104" y="64" width="${text.length * 13.2 + 28}" height="36" fill="${INK}"/><text x="118" y="89" font-family="${MONO}" font-size="22" fill="${C}" letter-spacing="1">${text}</text></g>`;
const chip = (x, y, text, w = 86) => `<rect x="${x}" y="${y - 22}" width="${w}" height="32" rx="5" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/><text x="${x + w / 2}" y="${y}" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="19" fill="${INK}">${text}</text>`;

const S = { intro: [0, 3.2], form: [3.2, 10], book: [10, 16.2], wallet: [16.2, 20], end: [20, 23] };
const END = S.end[1];

function frame(t) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C}"/>${rail}`;

  // ---- intro: the ferret comes up out of the paperwork
  if (t < S.intro[1]) {
    const o = (1 - ease(span(t, 2.8, 3.2))).toFixed(2);
    s += `<g opacity="${o}"><rect width="${W}" height="${H}" fill="${G}"/>${holes(C)}
      ${ferret(820, 240, 480, span(t, 0.3, 1.3))}
      <text x="110" y="330" font-family="${SLAB}" font-size="78" fill="${C}" letter-spacing="-2" opacity="${ease(span(t, 0.2, 0.8)).toFixed(2)}">Nobody reads</text>
      <text x="110" y="420" font-family="${SLAB}" font-size="78" fill="${C}" letter-spacing="-2" opacity="${ease(span(t, 0.6, 1.2)).toFixed(2)}">SEC filings.</text>
      <text x="114" y="490" font-family="${MONO}" font-size="24" fill="${BAR}" opacity="${ease(span(t, 1.5, 2.1)).toFixed(2)}">so the ferret went in</text></g>`;
  }

  // ---- 1 a real Form 4, the amount gets circled, the token is found
  if (t >= S.form[0] && t < S.form[1]) {
    const a = S.form[0], o = fade(t, S.form);
    const lines = [
      ['FORM 4', 'Statement of changes in beneficial ownership', 0.5],
      ['ISSUER', `${trade.company} (${trade.symbol})`, 1.1],
      ['PERSON', trade.owner, 1.7],
      ['ROLE', trade.role, 2.2],
      ['TRADE', `Bought ${trade.shares.toLocaleString('en-US')} shares at $${trade.price.toFixed(2)}`, 2.7],
      ['FILED', day(trade.filed), 3.3],
    ];
    s += `<g opacity="${o}">${kicker('DUG UP IN FORM 4', 1)}
      <rect x="104" y="128" width="690" height="402" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      ${lines.map(([k, v, at], i) => `
        ${i % 2 ? '' : `<rect x="105.5" y="${129.5 + i * 58}" width="687" height="58" fill="${BAR}"/>`}
        <text x="128" y="${165 + i * 58}" font-family="${MONO}" font-size="18" fill="${MUTED}" opacity="${ease(span(t, a + at - 0.2, a + at)).toFixed(2)}">${k}</text>
        <text x="236" y="${166 + i * 58}" font-family="${SANS}" font-weight="700" font-size="${i ? 23 : 19}" fill="${INK}">${typed(v, t, a + at, a + at + 0.5)}</text>`).join('')}
      <rect x="105.5" y="${129.5 + 6 * 58}" width="687" height="51" fill="${BAR}"/>
      <text x="128" y="${165 + 6 * 58}" font-family="${MONO}" font-size="18" fill="${MUTED}" opacity="${ease(span(t, a + 3.7, a + 3.9)).toFixed(2)}">VALUE</text>
      <text x="236" y="${170 + 6 * 58}" font-family="${SLAB}" font-size="34" fill="${INK}" opacity="${ease(span(t, a + 3.8, a + 4.1)).toFixed(2)}">${usd(trade.value)}, open-market buy</text>
      ${marker(303, 158 + 6 * 58, 86, 31, span(t, a + 4.3, a + 4.9))}
      ${ferret(860, 300, 420, span(t, a + 4.6, a + 5.3), dark)}
      <g opacity="${ease(span(t, a + 5.2, a + 5.6)).toFixed(2)}">
        <text x="104" y="598" font-family="${SANS}" font-weight="700" font-size="27" fill="${INK}">Can you hold it on Robinhood Chain?</text>
        <g transform="translate(590 0)">${chip(0, 598, trade.symbol)}</g>
        <text x="692" y="598" font-family="${MONO}" font-weight="700" font-size="21" fill="${G}">yes, it is a stock token</text>
      </g></g>`;
  }

  // ---- 2 a fund book, rows printed one by one, then how much of it exists on-chain
  if (t >= S.book[0] && t < S.book[1]) {
    const a = S.book[0], o = fade(t, S.book);
    const k = ease(span(t, a + 3.4, a + 4.8));
    s += `<g opacity="${o}">${kicker('DUG UP IN A 13F', 1)}
      <text x="104" y="158" font-family="${SLAB}" font-size="46" fill="${INK}" letter-spacing="-1">${esc(fund.manager)}'s book</text>
      <text x="${W - 80}" y="156" text-anchor="end" font-family="${MONO}" font-size="20" fill="${MUTED}">${esc(fund.firm)}, ${quarter}</text>
      <rect x="104" y="186" width="${W - 184}" height="${44 + rows.length * 48}" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      <rect x="104" y="186" width="${W - 184}" height="44" fill="${INK}"/>
      <text x="128" y="215" font-family="${MONO}" font-size="16" fill="${C}" letter-spacing="1">HOLDING</text>
      <text x="760" y="215" font-family="${MONO}" font-size="16" fill="${C}" letter-spacing="1">TOKEN</text>
      <text x="${W - 104}" y="215" text-anchor="end" font-family="${MONO}" font-size="16" fill="${C}" letter-spacing="1">WEIGHT</text>
      ${rows.map((h, i) => {
        const at = a + 0.5 + i * 0.42, y = 230 + i * 48;
        return `<g opacity="${ease(span(t, at, at + 0.3)).toFixed(2)}">
          ${i % 2 ? `<rect x="105.5" y="${y}" width="${W - 187}" height="${i === rows.length - 1 ? 46.5 : 48}" fill="${BAR}"/>` : ''}
          <text x="128" y="${y + 32}" font-family="${SANS}" font-weight="700" font-size="21" fill="${h.token ? INK : MUTED}">${esc(h.issuer)}</text>
          ${h.token ? chip(760, y + 32, h.token.symbol) : `<text x="760" y="${y + 31}" font-family="${MONO}" font-size="17" fill="${MUTED}">no token</text>`}
          <text x="${W - 104}" y="${y + 32}" text-anchor="end" font-family="${MONO}" font-size="20" fill="${INK}">${h.weight.toFixed(1)}%</text></g>`;
      }).join('')}
      <g opacity="${ease(span(t, a + 3.1, a + 3.5)).toFixed(2)}">
        <text x="104" y="596" font-family="${SANS}" font-weight="700" font-size="25" fill="${INK}">Exists as stock tokens</text>
        <rect x="400" y="574" width="560" height="28" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>
        <rect x="401.5" y="575.5" width="${(557 * k * fund.coverage / 100).toFixed(1)}" height="25" fill="${G}"/>
        <text x="${W - 80}" y="604" text-anchor="end" font-family="${SLAB}" font-size="52" fill="${INK}">${Math.round(fund.coverage * k)}%</text>
        ${marker(W - 150, 586, 96, 40, span(t, a + 4.8, a + 5.3))}
      </g></g>`;
  }

  // ---- 3 the wallet check
  if (t >= S.wallet[0] && t < S.wallet[1]) {
    const a = S.wallet[0], o = fade(t, S.wallet);
    const funds = [[fund.manager, 64], ['Cathie Wood', 31], ['Berkshire Hathaway', 12]];
    s += `<g opacity="${o}">${kicker('WALLET CHECK', 1)}
      <text x="104" y="158" font-family="${SLAB}" font-size="46" fill="${INK}" letter-spacing="-1">Which fund does a wallet smell like?</text>
      <rect x="104" y="196" width="760" height="62" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>
      <text x="126" y="236" font-family="${MONO}" font-size="24" fill="${INK}">${typed('0x7a3f…any address, read-only', t, a + 0.4, a + 1.3)}</text>
      <rect x="884" y="196" width="150" height="62" rx="6" fill="${INK}"/><text x="959" y="236" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="24" fill="${C}">Check</text>
      <g opacity="${ease(span(t, a + 1.6, a + 2.0)).toFixed(2)}">
        <text x="104" y="352" font-family="${SLAB}" font-size="50" fill="${INK}" letter-spacing="-1">This wallet is</text><text x="560" y="352" font-family="${SLAB}" font-size="50" fill="${INK}" letter-spacing="-1">64%</text><text x="732" y="352" font-family="${SLAB}" font-size="50" fill="${INK}" letter-spacing="-1">${esc(fund.manager)}</text>
        ${marker(622, 334, 88, 40, span(t, a + 2.1, a + 2.6))}
        ${funds.map(([name, v], i) => `
          <text x="104" y="${440 + i * 54}" font-family="${SANS}" font-weight="700" font-size="22" fill="${INK}">${esc(name)}</text>
          <rect x="370" y="${420 + i * 54}" width="560" height="24" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>
          <rect x="371.5" y="${421.5 + i * 54}" width="${(557 * v / 100 * ease(span(t, a + 2.0 + i * 0.15, a + 2.9 + i * 0.15))).toFixed(1)}" height="21" fill="${G}"/>
          <text x="1010" y="${440 + i * 54}" text-anchor="end" font-family="${MONO}" font-size="21" fill="${INK}">${v}%</text>`).join('')}
        <text x="104" y="632" font-family="${MONO}" font-size="18" fill="${MUTED}">example result. nothing to sign, nothing spent.</text>
      </g></g>`;
  }

  // ---- end card
  if (t >= S.end[0]) {
    const o = ease(span(t, S.end[0], S.end[0] + 0.5)).toFixed(2);
    s += `<g opacity="${o}"><rect width="${W}" height="${H}" fill="${G}"/>${holes(C)}
      ${ferret(820, 240, 480, 1)}
      <text x="110" y="300" font-family="${SLAB}" font-size="78" fill="${C}" letter-spacing="-2">The ferret</text>
      <text x="110" y="390" font-family="${SLAB}" font-size="78" fill="${C}" letter-spacing="-2">reads them.</text>
      ${marker(358, 362, 280, 54, span(t, S.end[0] + 0.6, S.end[0] + 1.2))}
      <text x="114" y="490" font-family="${MONO}" font-size="30" fill="${C}" letter-spacing="2">ferretcheck.com</text>
      <text x="114" y="532" font-family="${MONO}" font-size="20" fill="${BAR}">SEC filings, matched to stock tokens on Robinhood Chain</text></g>`;
  }
  return s + '</svg>';
}

const only = process.env.ONLY;
if (only) {
  for (const t of only.split(',').map(Number)) await sharp(Buffer.from(frame(t))).png().toFile(fileURLToPath(new URL(`./demo-${t}.png`, import.meta.url)));
  process.exit(0);
}
const dir = join(tmpdir(), 'ferret-demo-frames');
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const total = Math.round(END * FPS);
for (let i = 0; i < total; i++) await sharp(Buffer.from(frame(i / FPS))).png().toFile(join(dir, `f${String(i).padStart(4, '0')}.png`));
const out = fileURLToPath(new URL('./demo.mp4', import.meta.url));
execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out]);
rmSync(dir, { recursive: true, force: true });
console.log('wrote', out, total, 'frames');
