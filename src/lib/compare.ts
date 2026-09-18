/**
 * Cikken belüli összehasonlítás: azonos termékosztályon belüli, tényleg hasonló
 * termékek párosítása.
 *
 * A "csakis nagyon hasonló" szabály kétszintű:
 *  1. KEMÉNY guard: a jelölt pool CSAK azokból a cikkekből áll, amelyek a
 *     current cikkel közös termékosztályba esnek (óra csak órával — a cipő nem
 *     is kerülhet a poolba, mert nem esik az okosóra osztályba).
 *  2. Pontozási küszöb: osztályon belül is legalább két független jelzés kell
 *     (azonos márka, közös címke, közeli ár, közeli pontszám) — különben a
 *     "legjobb okosóra" listáról jönne egy 8 ezres karkötő egy 150 ezres
 *     sportóra mellé, ami értelmetlen párharc lenne.
 *
 * A kiegészítők (tok, pánt, porzsák stb.) sosem jelöltek: az isAccessoryPost
 * szűri őket ki, ugyanazzal a szabállyal, amit a toplisták használnak.
 */
import type { RankablePost } from '@/lib/data';
import { isAccessoryPost, postMatchesProductClass, productClassesForPost } from '@/lib/productClasses';
import { isAdultContent } from '@/lib/adultContent';

/** Az összehasonlító blokkban szereplő, leegyszerűsített cikk-nézet. */
export type ComparePost = Pick<
  RankablePost,
  | 'id'
  | 'slug'
  | 'title'
  | 'rating'
  | 'priceFt'
  | 'productName'
  | 'productBrand'
  | 'affiliateUrl'
  | 'pros'
  | 'cons'
  | 'tags'
> & {
  tags: { tag: { name: string } }[];
};

/** Párosítás eredménye a hasonlóság pontszámával és a felhasznált jelzésekkel. */
export type CompareMatch = {
  post: ComparePost;
  score: number;
  reasons: string[];
};

/** Ettől a pontszámtól jelenik meg egy páros a táblázatban (kalibrálva, lásd scripts/check-compare.ts). */
export const COMPARE_MIN_SCORE = 5;

/**
 * Vs-oldal (/osszehasonlitas/a-vs-b) sitemap-szűrése. A kis pontszámú párok
 * noindex, follow lesznek: valós tartalom, de több százszámra gyártani belőlük
 * indexelt oldalt a crawl budget munkánk ellen fordulna (lásd a címke-leckét).
 * Kalibráció: scripts/check-compare.ts, cél ~50-150 indexelt páros.
 */
export const VS_SITEMAP_MIN_SCORE = 9;
/** A sitemapbe kerülő vs-oldalak felső korlátja (a legmagasabb pontszámúak élveznek elsőbbséget). */
export const VS_SITEMAP_LIMIT = 150;
/** A /osszehasonlitas hub-oldalon legfeljebb ennyi páros link jelenik meg. */
export const VS_HUB_LIMIT = 300;

const sameBrand = (a: ComparePost, b: ComparePost): boolean =>
  !!a.productBrand &&
  !!b.productBrand &&
  a.productBrand.trim().toLowerCase() === b.productBrand.trim().toLowerCase();

/** Ár-arány: a kisebbet osztjuk a nagyobbal (1.0 = pontosan ugyanannyi). */
function priceRatio(a: ComparePost, b: ComparePost): number | null {
  if (a.priceFt == null || b.priceFt == null || a.priceFt <= 0 || b.priceFt <= 0) return null;
  const [lo, hi] = a.priceFt <= b.priceFt ? [a.priceFt, b.priceFt] : [b.priceFt, a.priceFt];
  return lo / hi;
}

/** Közös címkék (kisbetűs néven). */
function sharedTags(a: ComparePost, b: ComparePost): string[] {
  const bTags = new Set(b.tags.map((t) => t.tag.name.trim().toLowerCase()));
  return a.tags
    .map((t) => t.tag.name.trim().toLowerCase())
    .filter((t) => bTags.has(t) && t.length > 2);
}

/** Modellsorozat-jelző: azonos márka ÉS közös szó a terméknevekben (pl. "Venu 4" vs "Venu 3").
 *  Általános szavak (eau, spray, edp...) és a márkanév maga NEM számít sorozatjelzésnek,
 *  a sorozatszámra (záró számjegy) nem vagyunk érzékenyek: "Venu 4" és "Venu 3" ugyanaz a sorozat. */
const MODEL_STOPWORDS = new Set([
  'eau', 'parfum', 'toilette', 'edp', 'edt', 'spray', 'pour', 'homme', 'femme',
  'unisex', 'intense', 'elixir', 'mini', 'teszt', 'test', 'refillable', 'rollerball',
]);

function sharedModelWord(a: ComparePost, b: ComparePost): string | null {
  if (!sameBrand(a, b)) return null;
  const tokenize = (text: string) =>
    text
      .toLowerCase()
      .replace(/\d+\s*ml\b/g, ' ') // kötetjelzés ("100 ml", "50ml") nem modellszó
      .split(/[^a-z0-9áéíóöőúüű]+/i)
      .filter((w) => w.length >= 3)
      .map((w) => w.replace(/\d+$/, '')) // záró sorozatszám lecsupaszítva: "fold7" → "fold"
      .filter((w) => w.length >= 3 && !MODEL_STOPWORDS.has(w));
  const brandWords = new Set(tokenize(a.productBrand || ''));
  const wordsOf = (p: ComparePost) =>
    tokenize(p.productName || '').filter((w) => !brandWords.has(w));
  const bWords = new Set(wordsOf(b));
  return wordsOf(a).find((w) => bWords.has(w)) ?? null;
}

/**
 * Hasonlóság pontozása két, azonos osztályú cikk között.
 * NEM vizsgálja a hard guardokat (az a findCompareMatches dolga) — tiszta pontozó.
 */
export function similarityScore(a: ComparePost, b: ComparePost): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const tags = sharedTags(a, b);
  if (tags.length > 0) {
    score += 2;
    reasons.push('közös címke');
  }

  if (sameBrand(a, b)) {
    score += 3;
    reasons.push('azonos márka');
    const model = sharedModelWord(a, b);
    if (model) {
      score += 2;
      reasons.push(`ugyanannak a sorozatnak a tagja (${model})`);
    }
  }

  const ratio = priceRatio(a, b);
  if (ratio != null) {
    if (ratio >= 0.7) {
      score += 2;
      reasons.push('közel azonos ársáv');
    } else if (ratio >= 0.5) {
      score += 1;
      reasons.push('hasonló ársáv');
    }
  }

  if (a.rating != null && b.rating != null && Math.abs(a.rating - b.rating) <= 1) {
    score += 1;
    reasons.push('közel egyenrangú értékelés');
  }

  return { score, reasons };
}

/**
 * A current cikkhez kereshető összehasonlítási partnerek.
 *
 * Hard guardok (bármelyik elbukik → a cikk NEM szerepel a poolban):
 *  - azonos termékosztály a current cikkel (ez a "óra csak órával" alapja),
 *  - nem kiegészítő (isAccessoryPost),
 *  - nem 18+ tartalom,
 *  - van pontszáma.
 * Soft küszöb: similarityScore >= COMPARE_MIN_SCORE, és a "közös címke VAGY azonos
 * márka" feltétel is teljesül (puszta ár-közelség nem elég).
 */
// Az osztály-besorolás kulcsszó-regexekből áll: a build 670+ oldalt generál,
// oldalanként 670 jelöltet újra-besorolni drága lenne. Modulszintű memo: a
// process élettartama alatt minden cikket egyszer sorolunk be.
const classesMemo = new Map<string, ReturnType<typeof productClassesForPost>>();
function classesOf(post: RankablePost) {
  let classes = classesMemo.get(post.id);
  if (!classes) {
    classes = productClassesForPost(post, Number.MAX_SAFE_INTEGER);
    classesMemo.set(post.id, classes);
  }
  return classes;
}

export function findCompareMatches(
  current: ComparePost,
  pool: readonly RankablePost[],
  limit = 2
): CompareMatch[] {
  // A current cikk osztályai (ha nincs ismert osztálya, nincs mivel párosítani)
  const classes = classesOf(current as RankablePost);
  if (classes.length === 0) return [];
  if (isAdultContent(current as RankablePost)) return [];
  const classSlugs = new Set(classes.map((c) => c.slug));

  const matches: CompareMatch[] = [];

  for (const candidate of pool) {
    if (candidate.id === current.id) continue;
    if (candidate.rating == null) continue;
    if (isAccessoryPost(candidate)) continue;
    if (isAdultContent(candidate)) continue;
    // Hard guard: közös termékosztály
    if (!classesOf(candidate).some((c) => classSlugs.has(c.slug))) continue;

    const { score, reasons } = similarityScore(current, candidate as ComparePost);
    // Soft küszöb + minőségi feltétel: kell közös címke VAGY azonos márka
    if (score < COMPARE_MIN_SCORE) continue;
    if (!sameBrand(current, candidate as ComparePost) && sharedTags(current, candidate as ComparePost).length === 0) {
      continue;
    }

    matches.push({ post: candidate as ComparePost, score, reasons });
  }

  return matches.sort((a, b) => b.score - a.score || (b.post.rating ?? 0) - (a.post.rating ?? 0)).slice(0, limit);
}

/*
 * ------------------------------------------------------------------
 * Vs-oldalak (/osszehasonlitas/a-vs-b)
 *
 * A cikken belüli táblázat ugyanazt a párosítást használja fel itt,
 * állóoldalként: a "X vs Y" kereséseknek valódi keresőforgalma van.
 * A szabályok(szigorúság) azonos: csak azonos termékosztályú, minőségi
 * páros élhet — a URL-t nem lehet megbukni egy rossz párossal.
 * ------------------------------------------------------------------
 */

/** A páros URL-slugja: ábécérendben rendezve, hogy a csere-sorrend ugyanoda mutasson. */
export function comparePairSlug(slugA: string, slugB: string): string {
  return [slugA, slugB].sort().join('-vs-');
}

/**
 * Vs-URL feloldása a pool ellen: a raw slug összes "-vs-" szétvágási pontját
 * kipróbálja, és azt a kombinációt fogadja el, amelynél MINDKÉT slug létező cikk.
 * (Egy blogcikk címe is tartalmazhat "-vs-"-t — pl. "iphone-vs-android teszt" —,
 * ezért az első előfordulásnál való naiv vágás rossz párost adna.) Ha értelmezhető
 * pár található, de a motor nem minősíti, null-t ad: az oldal 404-et ad.
 */
export function resolveComparePair(
  raw: string,
  pool: readonly RankablePost[]
): { a: RankablePost; b: RankablePost; canonical: string; match: CompareMatch } | null {
  if (!raw || raw.length > 220) return null;
  let lc = raw.toLowerCase();
  try {
    lc = decodeURIComponent(raw).toLowerCase();
  } catch {
    // %-os hibás kódolás: marad a nyers érték, a charset-teszt úgyis elbuktatja
  }
  if (!/^[a-z0-9-]+$/.test(lc)) return null;

  const bySlug = new Map(pool.map((p) => [p.slug, p]));
  let idx = lc.indexOf('-vs-');
  while (idx > 0 && idx + 4 < lc.length) {
    const a = bySlug.get(lc.slice(0, idx));
    const b = bySlug.get(lc.slice(idx + 4));
    if (a && b && a.id !== b.id) {
      const match = canComparePosts(a.slug, b.slug, pool);
      return match ? { a, b, canonical: comparePairSlug(a.slug, b.slug), match } : null;
    }
    idx = lc.indexOf('-vs-', idx + 1);
  }
  return null;
}

/**
 * Két cikk (slug alapján) összemérhető-e: ugyanazok a guardok, mint a
 * cikken belüli párosításnál — azonos termékosztály, pontszám, nem kiegészítő,
 * nem 18+, minőségi küszöb, és kell közös címke VAGY azonos márka.
 * Visszaadja a páros pontszámát és indokait, vagy null-t, ha nem élhet.
 */
export function canComparePosts(
  slugA: string,
  slugB: string,
  pool: readonly RankablePost[]
): CompareMatch | null {
  const a = pool.find((p) => p.slug === slugA);
  const b = pool.find((p) => p.slug === slugB);
  if (!a || !b || a.id === b.id) return null;
  if (a.rating == null || b.rating == null) return null;
  if (isAccessoryPost(a) || isAccessoryPost(b)) return null;
  if (isAdultContent(a) || isAdultContent(b)) return null;
  const classSlugs = new Set(classesOf(a).map((c) => c.slug));
  if (!classesOf(b).some((c) => classSlugs.has(c.slug))) return null;

  const { score, reasons } = similarityScore(a, b);
  if (score < COMPARE_MIN_SCORE) return null;
  if (!sameBrand(a, b) && sharedTags(a, b).length === 0) return null;
  return { post: b as ComparePost, score, reasons };
}

/** Egy minőségi páros a hub/sitemap felsoroláshoz. */
export type ComparePair = {
  a: ComparePost;
  b: ComparePost;
  score: number;
  reasons: string[];
  slug: string;
  /** Az első közös termékosztály slugja (a hub csoportosításához). */
  classSlug: string;
};

const pairKey = (idA: string, idB: string) => (idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`);

/**
 * Minden minőségi páros felsorolása (minden páros pontosan egyszer, a legmagasabb
 * pontszámúakkal az élen). A hub-oldal, a sitemap és a generateStaticParams ebből
 * dolgozik — egyetlen igazság a párokra, mint a cikken belüli táblázatnál.
 */
export function listComparePairs(pool: readonly RankablePost[]): ComparePair[] {
  const eligible = pool.filter(
    (p) => p.rating != null && !isAccessoryPost(p) && !isAdultContent(p)
  );

  // Osztályonkénti poolok: a párosok CSAK osztályon belül keletkezhetnek
  const byClass = new Map<string, RankablePost[]>();
  for (const p of eligible) {
    for (const cls of classesOf(p)) {
      const arr = byClass.get(cls.slug);
      if (arr) arr.push(p);
      else byClass.set(cls.slug, [p]);
    }
  }

  const seen = new Set<string>();
  const pairs: ComparePair[] = [];
  for (const [classSlug, members] of byClass) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        const key = pairKey(a.id, b.id);
        if (seen.has(key)) continue;
        seen.add(key);

        const { score, reasons } = similarityScore(a, b);
        if (score < COMPARE_MIN_SCORE) continue;
        if (!sameBrand(a, b) && sharedTags(a, b).length === 0) continue;
        pairs.push({
          a: a as ComparePost,
          b: b as ComparePost,
          score,
          reasons,
          slug: comparePairSlug(a.slug, b.slug),
          classSlug,
        });
      }
    }
  }

  return pairs.sort(
    (x, y) =>
      y.score - x.score ||
      (y.a.rating ?? 0) - (x.a.rating ?? 0) ||
      (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0)
  );
}

/** A páros indexelhető-e (robots) a pontszáma alapján. */
export function isVsPairSitemapEligible(score: number): boolean {
  return score >= VS_SITEMAP_MIN_SCORE;
}

/** A sitemapbe kerülő párok: küszöb + limit, determinisztikus sorrenddel. */
export function vsSitemapPairs(pairs: readonly ComparePair[]): ComparePair[] {
  return pairs
    .filter((p) => isVsPairSitemapEligible(p.score))
    .sort((x, y) => y.score - x.score || (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0))
    .slice(0, VS_SITEMAP_LIMIT);
}
