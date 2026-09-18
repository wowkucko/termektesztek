/**
 * Termékosztály-toplisták (pl. "legjobb air fryer", "legjobb gamer fejhallgató").
 *
 * Miért külön a kategóriáktól? A blog 7 kategóriája (Otthon és konyha stb.) nem
 * keresési szándék: senki nem írja be, hogy "legjobb otthon és konyha". A valódi
 * kereslet termékosztály-szinten van ("legjobb air fryer 40 ezer alatt"), ezért
 * ezek a /legjobb/{slug} alatt, kategóriától független szabályokkal épülnek.
 *
 * A cikkeket kulcsszó-illesztéssel soroljuk be, hogy ne kelljen kézzel karbantartani
 * 670 bejegyzést. Az illesztés SZÓ ELEJÉN történik, ékezet nélküli, kisbetűs
 * szövegen: a "porsziv" kulcsszó így talál a "porszívó", "porszívóval" alakokra,
 * de a "eger" nem talál rá véletlenül a "keverő" szóra (mert az nem "eger"-rel
 * kezdődik). Az `exclude` listával lehet kizárni (pl. a robotporszívót a
 * "porszívó" osztályból).
 */
import type { RankablePost } from '@/lib/data';
import { normalizeProductName } from '@/lib/utils';

// Szándékosan csak TÍPUS-függőség van az adatrétegre: a besorolás és a rangsorolás
// tiszta függvény marad, így a scripts/check-product-classes.ts (és bármelyik
// adatforrás) külön adatbázis-kapcsolat nélkül is tudja használni.

/** Ennyi cikk alatt az osztály-toplista vékony: noindex, follow (és nem kerül a sitemapbe). */
export const MIN_POSTS_FOR_PRODUCT_CLASS = 3;

export type ProductClass = {
  slug: string;
  /** A listaoldal neve, kereshető alakban (pl. "air fryer"). */
  name: string;
  /** A szülőkategória (a morzsamenühöz és a belső linkeléshez). */
  categorySlug: string;
  /** Ékezet nélküli, kisbetűs kulcsszavak; szó eleji egyezés a cikk szövegében. */
  keywords: string[];
  /** Ha bármelyik szerepel a cikkben, nem tartozik az osztályba. */
  exclude?: string[];
  /** Ársáv-felső határok forintban (a "Mind" sáv automatikusan bekerül). */
  priceBands?: number[];
  /** Egyedi bevezető a listaoldalra (a keresőben is ez jelenik meg röviden). */
  blurb: string;
};

export const PRODUCT_CLASSES: readonly ProductClass[] = [
  {
    slug: 'air-fryer',
    name: 'air fryer',
    categorySlug: 'otthon-es-konyha',
    keywords: ['air fryer', 'airfryer', 'forrolevegos suto', 'forrolevegos fritoz', 'forro levegos suto'],
    priceBands: [30000, 60000, 100000],
    blurb:
      'A forrólevegős sütő a konyha legtöbbet használt gépe lett: kevesebb olajjal, gyorsabban készül benne a vacsora. Ebben a rangsorban a nálunk megjelent tesztek pontszámai alapján soroljuk be a modelleket, ársávra bontva is.',
  },
  {
    slug: 'konyhai-robotgep',
    name: 'konyhai robotgép',
    categorySlug: 'otthon-es-konyha',
    keywords: ['konyhai robotgep', 'robotgep', 'food processor', 'dagasztogep'],
    priceBands: [50000, 100000, 200000],
    blurb:
      'Dagasztás, aprítás, turmixolás: a konyhai robotgép akkor éri meg, ha a kapacitása és a tartozékai illenek a mindennapi főzéshez. A rangsor a legismertebb modelleket hasonlítja össze pontszám és ár szerint.',
  },
  {
    slug: 'robotporszivo',
    name: 'robotporszívó',
    categorySlug: 'otthon-es-konyha',
    keywords: ['robotporsziv', 'robot porsziv'],
    priceBands: [100000, 200000, 350000],
    blurb:
      'A robotporszívó az önálló takarítás egyik legjobb befektetése, de a lézeres navigáció, a szívóerő és a karbantartási költség modellenként nagyon eltér. Itt a legjobbra értékelt robotporszívókat találod, ár szerint is szűrve.',
  },
  {
    slug: 'porszivo',
    name: 'porszívó',
    categorySlug: 'otthon-es-konyha',
    keywords: ['porsziv'],
    exclude: ['robotporsziv', 'robot porsziv'],
    priceBands: [50000, 100000, 200000],
    blurb:
      'Rudas és kézi porszívók tesztjei egy helyen: szívóerő, üzemidő, súly és a való életben fontos apróságok (mennyire könnyű a tartály ürítése). A robotporszívókat külön toplistán gyűjtöttük.',
  },
  {
    slug: 'okostv',
    name: 'okostévé',
    categorySlug: 'otthon-es-konyha',
    keywords: ['okostv', 'okosteve', 'smart tv', 'televiz', '4k tv'],
    priceBands: [100000, 200000, 400000],
    blurb:
      'A tévévásárlásnál a képminőség, a HDR-kezelés és az okosrendszer sebessége dönt. Ezekben a magyar nyelvű tesztekben pontosan ezeket néztük meg, a rangsor pedig a pontszámok alapján áll össze.',
  },
  {
    slug: 'olajsuto',
    name: 'olajsütő',
    categorySlug: 'otthon-es-konyha',
    keywords: ['olajsuto', 'fritoz'],
    exclude: ['forrolevegos', 'forro levegos', 'air fryer', 'airfryer'],
    priceBands: [30000, 60000],
    blurb:
      'Klasszikus olajsütő és fritőz: nagy adagok, ropogós végeredmény, cserébe olaj és tisztítás. A listán azok a modellek szerepelnek, amelyek a tesztekben a legjobb pontszámot kapták.',
  },
  {
    slug: 'okostelefon',
    name: 'okostelefon',
    categorySlug: 'okostelefonok',
    keywords: ['okostelefon', 'iphone', 'galaxy s', 'galaxy a', 'redmi', 'pixel'],
    priceBands: [100000, 250000, 400000],
    blurb:
      'A tesztekben a kamera, az üzemidő, a kijelző és a szoftveres támogatás hossza döntött. Az okostelefon-rangsor pontszám szerint sorolja a modelleket, így látszik, hol a legjobb az ár-érték arány.',
  },
  {
    slug: 'okosora',
    name: 'okosóra',
    categorySlug: 'hordhato-eszkozok',
    keywords: ['okosora', 'okoskarkoto', 'smartwatch', 'sportora', 'aktivitasmero'],
    priceBands: [50000, 100000, 200000],
    blurb:
      'Okosóra és fitness karkötő: a mérés pontossága, az akkuidő és az alkalmazás minősége a három dolog, ami hosszú távon számít. A rangsor a magyar nyelvű tesztek pontszámai alapján készült.',
  },
  {
    slug: 'gamer-fejhallgato',
    name: 'gamer fejhallgató',
    categorySlug: 'szamitastechnika',
    keywords: ['fejhallgato', 'headset'],
    priceBands: [30000, 60000, 100000],
    blurb:
      'Játékhoz a térhangzás, a mikrofon és a hosszú távú kényelem a lényeg — nem a mélyhangok mennyisége. Ezekben a tesztekben ezeket mértük, a rangsor pedig a pontszámok alapján áll össze.',
  },
  {
    slug: 'gamer-eger',
    name: 'gamer egér',
    categorySlug: 'szamitastechnika',
    keywords: ['eger'],
    priceBands: [15000, 30000, 60000],
    blurb:
      'A gamer egérnél a súly, a szenzor, a kattintásérzet és a forma illeszkedése dönt — a drágább nem mindig jobb. A rangsor a tesztek pontszámait követi, ársáv szerint is böngészhető.',
  },
  {
    slug: 'mechanikus-billentyuzet',
    name: 'mechanikus billentyűzet',
    categorySlug: 'szamitastechnika',
    keywords: ['mechanikus billentyuzet', 'billentyuzet', 'keyboard'],
    priceBands: [30000, 60000, 100000],
    blurb:
      'A mechanikus billentyűzetnél a kapcsoló típusa, a ház anyaga és a hangja legalább annyit számít, mint a márka. Itt gyűjtöttük a legjobbra értékelt modelleket, irodai és játékos felhasználásra is.',
  },
  {
    slug: '3d-nyomtato',
    name: '3D nyomtató',
    categorySlug: 'szamitastechnika',
    keywords: ['3d nyomtat'],
    priceBands: [100000, 250000, 500000],
    blurb:
      'A 3D nyomtatás belépőszintje ma már 100 ezer forint alatt kezdődik, a különbség a felépítésben, a kalibrálásban és a zajban van. A rangsor a tesztjeink pontszámai alapján készült.',
  },
  {
    slug: 'hajszarito',
    name: 'hajszárító',
    categorySlug: 'szepsegapolas',
    keywords: ['hajszarit'],
    priceBands: [20000, 40000, 80000],
    blurb:
      'A hajszárítónál a levegő hőmérséklete és a sebessége dönti el, mennyire kíméli a hajat — és hogy mennyi idő a reggeli készülődés. A rangsor a leggyakoribb modelleket hasonlítja össze.',
  },
  {
    slug: 'hajvasalo',
    name: 'hajvasaló',
    categorySlug: 'szepsegapolas',
    // A "hajformázás" címke túl tág (hajszárítón és körkefén is rajta van),
    // ezért a hajvasaló-osztály a konkrét eszköznevekre szűkít.
    keywords: ['hajvasal', 'styler', 'airwrap'],
    exclude: ['hajszarit', 'korkefe', 'hajkefe'],
    priceBands: [15000, 40000, 80000],
    blurb:
      'Hajvasaló és hajformázó: a hőfok szabályozása, a felfűtés gyorsasága és a felület minősége a három szempont, amiben a modellek igazán eltérnek. A pontszámok a nálunk megjelent tesztekből származnak.',
  },
  {
    slug: 'parfum',
    name: 'parfüm',
    categorySlug: 'szepsegapolas',
    keywords: ['parfum', 'eau de parfum', 'edp', 'edt'],
    priceBands: [20000, 50000, 100000],
    blurb:
      'A parfüm az egyik legszemélyesebb vásárlás: a tartósság és a helyzet, amiben hordod, legalább annyit számít, mint az ismertség. A rangsor a tesztek pontszámai alapján áll össze, ársávra bontva is.',
  },
];

const CLASS_BY_SLUG = new Map(PRODUCT_CLASSES.map((c) => [c.slug, c]));

export function getProductClass(slug: string): ProductClass | null {
  return CLASS_BY_SLUG.get(slug) ?? null;
}

/** Az adott kategóriába tartozó termékosztályok (a kategóriaoldal linkeléséhez). */
export function productClassesForCategory(categorySlug: string): ProductClass[] {
  return PRODUCT_CLASSES.filter((c) => c.categorySlug === categorySlug);
}

/**
 * A cikkből készített, ékezet nélküli, kisbetűs szöveg.
 *
 * Szándékosan a cím + terméknév/márka + címkék alapján sorolunk be, az
 * összefoglaló NÉLKÜL: az összefoglaló gyakran hasonlítja a terméket máshoz
 * ("nem hajformázó, hanem szárító"), és ilyenkor egy toplistába tévesen
 * kerülne át a másik osztály terméke.
 */
export function productClassHaystack(
  post: Pick<RankablePost, 'title' | 'productName' | 'productBrand' | 'tags'>
): string {
  return normalizeProductName(
    [post.title, post.productName, post.productBrand, post.tags.map((t) => t.tag.name).join(' ')]
      .filter(Boolean)
      .join(' ')
  );
}

/**
 * Kiegészítők, tartozékok, pótalkatrészek: ezek nem termékek egy "legjobb X"
 * rangsorban (pl. okosóra szíj, porszívó porzsák, utángyártott tartozékkészlet).
 * Csak a címre és a terméknévre nézzük, hogy egy általános dicsérő mondat ne
 * zárjon ki valódi terméket.
 */
const ACCESSORY_KEYWORDS = [
  'tartozek',
  'kiegeszit',
  'utangyartott',
  'potalkatresz',
  'porzsak',
  'szuro',
  'szij',
  'betet',
  'keszlet',
  'kabel',
  'tok',
  'vedofilm',
  'szakacskonyv',
  'konyv',
  // Nyomtató tartozék SKU (pl. "AnkerMake M5 sárgaréz fúvóka 0.8mm") — két fúvóka
  // összehasonlítása értelmetlen páros lenne a compare-ben és a toplistákban is.
  'fuvoka',
];

export function isAccessoryPost(post: Pick<RankablePost, 'title' | 'productName'>): boolean {
  const text = normalizeProductName([post.title, post.productName].filter(Boolean).join(' '));
  const words = text.split(' ');
  return ACCESSORY_KEYWORDS.some((kw) => words.some((w) => w.startsWith(kw)));
}

/**
 * Kulcsszó-egyezés szó ELEJÉN: a kulcsszó minden szava ott kell kezdődjön egy-egy
 * szövegszó elején (a magyar toldalékot engedjük: "porsziv" -> "porszívóval").
 * Több szavas kulcsszónál a szavak egymás után következnek.
 */
function keywordMatches(haystack: string, keyword: string): boolean {
  const kw = normalizeProductName(keyword).split(' ').filter(Boolean);
  if (kw.length === 0) return false;
  const words = haystack.split(' ').filter(Boolean);
  if (kw.length === 1) return words.some((w) => w.startsWith(kw[0]));
  for (let i = 0; i + kw.length <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < kw.length; j++) {
      if (!words[i + j].startsWith(kw[j])) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** A cikk ehhez az osztályhoz tartozik-e (kulcsszó-egyezés, a kizárások tiszteletben tartásával). */
export function postMatchesProductClass(
  post: Pick<RankablePost, 'title' | 'productName' | 'productBrand' | 'tags'>,
  cls: ProductClass
): boolean {
  if (isAccessoryPost(post)) return false;
  const haystack = productClassHaystack(post);
  if (cls.exclude?.some((k) => keywordMatches(haystack, k))) return false;
  return cls.keywords.some((k) => keywordMatches(haystack, k));
}

/** Mely osztályokhoz tartozik a cikk (a cikkoldali belső linkeléshez). */
export function productClassesForPost(
  post: Pick<RankablePost, 'title' | 'productName' | 'productBrand' | 'tags'>,
  limit = 3
): ProductClass[] {
  return PRODUCT_CLASSES.filter((c) => postMatchesProductClass(post, c)).slice(0, limit);
}

export type PriceBand = { label: string; value: number | null };

/** "40 ezer Ft alatt" felirat a Ft-ban megadott felső határból. */
export function priceBandLabel(value: number): string {
  if (value >= 1000 && value % 1000 === 0) {
    const thousands = value / 1000;
    return thousands >= 1000
      ? `${(thousands / 1000).toLocaleString('hu-HU')} millió Ft alatt`
      : `${thousands} ezer Ft alatt`;
  }
  return `${value.toLocaleString('hu-HU')} Ft alatt`;
}

/** Az osztály ársávjai, a "Mind" opcióval az élen. */
export function priceBandsFor(cls: ProductClass): PriceBand[] {
  return [
    { label: 'Mind', value: null },
    ...(cls.priceBands ?? []).map((value) => ({ label: priceBandLabel(value), value })),
  ];
}

/**
 * Az osztály toplistája: csak értékelt cikkek, pontszám (majd frissesség) szerint
 * csökkenő sorrendben, opcionális ársáv-felső határral. A cikklistát kívülről
 * kapja (lásd getRankablePosts), így egy kérésen belül egy lekérdezés elég.
 */
export function rankProductClassPosts(
  posts: readonly RankablePost[],
  cls: ProductClass,
  maxPriceFt?: number | null,
  take = 10
): RankablePost[] {
  return posts
    .filter((p) => p.rating != null && postMatchesProductClass(p, cls))
    .filter((p) => maxPriceFt == null || (p.priceFt != null && p.priceFt <= maxPriceFt))
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
    )
    .slice(0, take);
}

/** Az osztályba tartozó cikkek száma (a vékony osztályok kiszűréséhez). */
export function countProductClassPosts(posts: readonly RankablePost[], cls: ProductClass): number {
  return posts.filter((p) => p.rating != null && postMatchesProductClass(p, cls)).length;
}

/** Osztályonkénti cikkszám (sitemap, kategóriaoldali linkelés). */
export function productClassCounts(
  posts: readonly RankablePost[]
): { cls: ProductClass; count: number }[] {
  return PRODUCT_CLASSES.map((cls) => ({ cls, count: countProductClassPosts(posts, cls) }));
}
