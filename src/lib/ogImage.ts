/**
 * Dinamikus OG-kártyák renderelése sharp + SVG úton.
 *
 * Miért nem a Next `opengraph-image.tsx` / `ImageResponse` (satori) útja?
 * A Next 14 `@vercel/og` modulja Windows-on modulbetöltéskor elszáll
 * (a beépített Noto Sans fallback `new URL(..., import.meta.url)` töltése
 * `ERR_INVALID_URL`-t ad), és a satori a webfontok letöltését is megkövetelné
 * minden rendernél. Az SVG→sharp út ezzel szemben:
 *   - a függőségben már lévő sharp-ot használja,
 *   - rendszerfontokat használ (Windows: Segoe UI, Linux/prod: DejaVu),
 *   - nincs hálózati függőség, gyors és determinisztikus.
 *
 * A kártyák a site arculatát viszik (paper háttér, ink szöveg, signal pecsét,
 * teal akcent — lásd tailwind.config.ts), mert a megosztási képnek kell, hogy
 * felismerhető legyen az oldalról.
 */
import 'server-only';
import sharp from 'sharp';
import { SITE_NAME } from './seo';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

// Design tokenek (tailwind.config.ts)
const C = {
  paper: '#F2F4F1',
  ink: '#12191A',
  teal: '#0E6E63',
  signal: '#E8542A',
  signal700: '#9A3417',
  line: 'rgba(18,25,26,0.14)',
  muted: 'rgba(18,25,26,0.65)',
} as const;

const SANS = "'Segoe UI', 'DejaVu Sans', Arial, sans-serif";
const SERIF = "Georgia, 'DejaVu Serif', serif";

/** XML escape (a szövegek SVG-be mennek). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Egyszerű szóhatáros tördelés max. `maxLines` sorra, végső sor '…'-tal. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  const wrapped = lines.join(' ');
  if (lines.length === maxLines && wrapped.length < text.length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S+$/, '') + '…';
  }
  return lines;
}

function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Cikk-kártya: kicker (kategória), cím max. 3 sorban, pontszám-pecsét,
 * alul a tesztelt termék és a site-név.
 */
export async function renderPostOgPng(input: {
  kicker: string;
  title: string;
  rating: string | null;
  footer: string | null;
}): Promise<Buffer> {
  const hasSeal = input.rating != null;
  // Karakter/szám arány a 56px bold sans-hoz (kb. 0.52 × méret)
  const maxChars = hasSeal ? 26 : 33;
  const lines = wrapText(input.title, maxChars, 3);
  const lineHeight = 68;
  const titleTop = 230;
  const titleSpans = lines
    .map((l, i) => `<tspan x="70" dy="${i === 0 ? 0 : lineHeight}">${esc(l)}</tspan>`)
    .join('');

  const seal =
    hasSeal && input.rating
      ? `
  <circle cx="970" cy="315" r="80" fill="none" stroke="${C.signal}" stroke-width="5" stroke-dasharray="14 10"/>
  <text x="970" y="334" text-anchor="middle" font-family="${SANS}" font-size="54" font-weight="700" fill="${C.signal700}">${esc(input.rating)}</text>
  <text x="970" y="372" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="700" letter-spacing="2" fill="${C.signal700}">/ 10 PONT</text>`
      : '';

  const svg = `<svg width="${OG_IMAGE_SIZE.width}" height="${OG_IMAGE_SIZE.height}" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${C.paper}"/>
  <circle cx="70" cy="79" r="9" fill="${C.signal}"/>
  <text x="94" y="87" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="2" fill="${C.muted}">${esc(input.kicker)}</text>
  <text font-family="${SANS}" font-size="56" font-weight="700" fill="${C.ink}">${titleSpans}</text>${seal}
  <line x1="70" y1="540" x2="1130" y2="540" stroke="${C.line}" stroke-width="2"/>
  <text x="70" y="580" font-family="${SERIF}" font-size="24" fill="${C.muted}">${esc(input.footer ?? '')}</text>
  <text x="1130" y="580" text-anchor="end" font-family="${SANS}" font-size="24" font-weight="700" fill="${C.teal}">${esc(SITE_NAME)}</text>
</svg>`;
  return svgToPng(svg);
}

/**
 * Toplista-kártya: cím max. 2 sorban + top-3 termék pontszámmal (pont-buborékokkal).
 */
export async function renderToplistOgPng(input: {
  kicker: string;
  title: string;
  items: { name: string; score: string }[];
}): Promise<Buffer> {
  const lines = wrapText(input.title, 38, 2);
  const titleSpans = lines
    .map((l, i) => `<tspan x="52" dy="${i === 0 ? 0 : 58}">${esc(l)}</tspan>`)
    .join('');

  const rowH = 88;
  const rowGap = 14;
  const rowsTop = 252;
  const rows = input.items
    .slice(0, 3)
    .map((item, i) => {
      const top = rowsTop + i * (rowH + rowGap);
      const cy = top + rowH / 2;
      const name = item.name.length > 62 ? `${item.name.slice(0, 61).trimEnd()}…` : item.name;
      return `
  <rect x="52" y="${top}" width="1096" height="${rowH}" rx="16" fill="white" stroke="${C.line}" stroke-width="2"/>
  <text x="80" y="${cy + 11}" font-family="${SANS}" font-size="30" font-weight="700" fill="${C.signal}">${i + 1}.</text>
  <text x="140" y="${cy + 9}" font-family="${SANS}" font-size="26" font-weight="600" fill="${C.ink}">${esc(name)}</text>
  <circle cx="1104" cy="${cy}" r="40" fill="${C.teal}"/>
  <text x="1104" y="${cy + 10}" text-anchor="middle" font-family="${SANS}" font-size="26" font-weight="700" fill="white">${esc(item.score)}</text>`;
    })
    .join('');

  const footerY = rowsTop + input.items.slice(0, 3).length * (rowH + rowGap) + 24;

  const svg = `<svg width="${OG_IMAGE_SIZE.width}" height="${OG_IMAGE_SIZE.height}" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${C.paper}"/>
  <circle cx="66" cy="80" r="8" fill="${C.signal}"/>
  <text x="88" y="88" font-family="${SANS}" font-size="21" font-weight="700" letter-spacing="2" fill="${C.muted}">${esc(input.kicker)}</text>
  <text x="1130" y="88" text-anchor="end" font-family="${SANS}" font-size="21" font-weight="700" fill="${C.teal}">${esc(SITE_NAME)}</text>
  <text font-family="${SANS}" font-size="50" font-weight="700" fill="${C.ink}">${titleSpans}</text>${rows}
  <line x1="52" y1="${footerY}" x2="1148" y2="${footerY}" stroke="${C.line}" stroke-width="2"/>
  <text x="52" y="${footerY + 38}" font-family="${SERIF}" font-size="22" fill="${C.muted}">Magyar nyelvű tesztek alapján rangsorolva</text>
  <text x="1148" y="${footerY + 38}" text-anchor="end" font-family="${SANS}" font-size="22" font-weight="700" fill="${C.teal}">toplista</text>
</svg>`;
  return svgToPng(svg);
}
