export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
}

export function readingTimeMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + '…';
}

// "129 990 Ft" / "1 234,56 zł" jellegű ár-szövegből egész forint (csak számjegyek).
// Visszatér undefined-dal, ha nincs benne értelmezhető szám.
export function parsePriceFt(price?: string | null): number | undefined {
  if (!price) return undefined;
  const digits = price.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const value = parseInt(digits, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

// 129990 -> "129 990 Ft" (magyar ezres tagolás)
export function formatPriceFt(value?: number | null): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ft`;
}

// Allegro termék-URL-ből az ajánlat-azonosító (offerId) kinyerése.
// Ugyanaz az offer = ugyanaz a konkrét termékajánlat -> duplikátum.
export function extractOfferId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?&]offerId=(\d+)/);
  return m ? m[1] : null;
}

// Terméknév normalizálása összehasonlításhoz: kisbetű, ékezet nélkül,
// csak betűk/számok, egyszeres szóközökkel. Pl. "Philips Airfryer XL!" ==
// "philips airfryer xl".
export function normalizeProductName(name?: string | null): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ő/g, 'o')
    .replace(/ű/g, 'u')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// Szerveroldali Post -> kliensre küldhető JSON (dátumok ISO-stringgé alakítva).
// Az InfinitePostList kezdeti elemeihez.
import type { ClientPost } from '@/components/site/PostCardClient';

export function toClientPosts(
  posts: {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    coverImage: string | null;
    coverImageAlt: string | null;
    rating: number | null;
    publishedAt: Date | null;
    category: { name: string; slug: string };
  }[]
): ClientPost[] {
  return posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    coverImageAlt: p.coverImageAlt,
    rating: p.rating,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    category: { name: p.category.name, slug: p.category.slug },
  }));
}

// Minden minta ékezet nélküli kisbetűs (a normalizeProductName kimenetére illeszkedik).
const TECH_PROTECTED_NORM = /okosora|okoskarkoto|aktivitasmero|fulhallgato|fejhallgato|headset|vr.?szemuveg|okosszemuveg/i;

const WHOLE_WORD_RULES: { slug: string; words: string[] }[] = [
  {
    slug: 'divat',
    words: ['ruha', 'ruhak', 'kabat', 'dzseki', 'melleny', 'farmer', 'polo', 'ing', 'nadrag', 'nadragok', 'szoknya', 'taska', 'taskak', 'hatizsak', 'borond', 'napszemuveg', 'karora', 'karorak', 'ekszer', 'nyaklanc', 'penztarca', 'sal', 'sapka', 'kesztyu', 'fehernemu', 'furdoruha', 'pizsama', 'overal', 'overall', 'cipo', 'cipok', 'papucs', 'papucsok', 'csizma', 'csizmak', 'bakancs', 'bakancsok'],
  },
  {
    slug: 'jatekok',
    words: ['tarsasjatek', 'tarsas', 'kartyajatek', 'kirako', 'babahaz', 'matchbox', 'makett', 'taviranyitos', 'modellauto'],
  },
];

const SUBSTRING_RULES: { slug: string; stems: string[] }[] = [
  {
    slug: 'divat',
    stems: ['cipo', 'sneaker', 'papucs', 'csizma', 'szandal', 'bakancs', 'tornacipo', 'futocipo', 'magassarku', 'klumpa'],
  },
  {
    slug: 'jatekok',
    stems: ['figura', 'gyujtheto', 'lego', 'duplo', 'puzzle', 'pluss', 'hot wheels', 'kifesto'],
  },
  {
    slug: 'szepsegapolas',
    stems: ['hajvasalo', 'hajszarito', 'hajkefe', 'epilator', 'borotva', 'multistyler', 'airwrap', 'supersonic', 'airstrait', 'flyaway'],
  },
];

// Visszatér a kategória-sluggal, ha a terméknév egyértelműen besorolható,
// különben null-lal (ilyenkor a Gemini döntése marad).
export function matchCategoryByKeywords(name?: string | null): string | null {
  const norm = normalizeProductName(name);
  if (!norm) return null;
  if (TECH_PROTECTED_NORM.test(norm)) return null; // okosóra, fülhallgató stb. marad tech
  const tokens = new Set(norm.split(' '));
  const padded = ` ${norm} `;
  for (const rule of WHOLE_WORD_RULES) {
    if (rule.words.some((w) => tokens.has(w))) return rule.slug;
  }
  for (const rule of SUBSTRING_RULES) {
    if (rule.stems.some((s) => padded.includes(s))) return rule.slug;
  }
  return null;
}
