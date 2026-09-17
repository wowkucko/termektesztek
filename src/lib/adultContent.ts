/**
 * 18+ (felnőtt) tartalom felismerése + a korhatár-kapu (age gate) állandói.
 *
 * A blog olyan termékteszteket is közöl, amelyek szexuális jellegű termékről
 * szólnak. Az ilyen cikkeket a kiskorúak védelmében (az audiovizuális
 * médiaszolgáltatásokról szóló 2010/13/EU irányelv 12. cikke és a magyar
 * médiaszabályozás szellemében) csak 18 éven felüliek olvashatják: a cikk
 * teljes tartalma csak a korhatár-kapu elfogadása után renderelődik.
 *
 * A felismerés kulcsszó-alapú, két szinten:
 *   - ERŐS találat: önmagában egyértelműen szexuális tartalom (pl. "dildó",
 *     "szexjáték", "pornó", "síkosító") → azonnal 18+;
 *   - GYENGE találat: csak támogató jelzés (pl. "intim", "szexi", "kegel",
 *     "kenőanyag"), súlyozva. A cím, az összefoglaló, a terméknév/márka, a
 *     címkék és a kategória háromszoros súlyt kapnak a törzsszöveggel szemben,
 *     és csak a küszöb (ADULT_WEAK_THRESHOLD) elérésekor lesz a cikk 18+.
 *
 * Így a hétköznapi tesztek nem esnek a kapu alá: egy parfümteszt "intim illata"
 * vagy egy autós cikk "kenőanyag" szava önmagában nem elég, két-három egymást
 * erősítő jelzés viszont már igen.
 *
 * A minták a szó ELEJÉNÉL horgonyoznak (a magyar összetételben a szexuális tag
 * tipikusan elöl áll: szexjáték, pornófilm), ezért a "kanál" nem lesz "anál",
 * és az angol "anal" sem illeszkedik az "analóg" / "analízis" szavakra.
 */

/** A korhatár-elfogadást tároló süti neve (szerveroldalon is ezt olvassuk). */
export const ADULT_CONSENT_COOKIE = 'adult-consent';

/**
 * A süti értéke verziózott: ha a kapu szövege / jogi háttere érdemben változik,
 * elég a verziót léptetni, és mindenki újra elfogadja.
 */
export const ADULT_CONSENT_VALUE = 'v1';

/** Meddig érvényes egy elfogadás (30 nap) - utána újra meg kell erősíteni. */
export const ADULT_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * A gyenge jelzések pontszám-küszöbe. Egy címbeli jelzés 3 pontot ér, tehát
 * két gyenge szó a címben/összefoglalóban már 18+ tartalmat jelez.
 */
export const ADULT_WEAK_THRESHOLD = 6;

// A magyar ábécé betűi, hogy a minta ne csússzon át a szó határán
// (\w és \b csak ASCII-t ismer, ezért saját lookaround-ot használunk).
const HUL = 'a-záéíóöőúüű';

/**
 * Erős magyar minták: önmagukban is 18+ tartalmat jeleznek. A minta a szó
 * elején horgonyzik, a toldalékokat ([HUL]*) a minta tartalmazza
 * (szexuális, dildók, síkosítóval...), ezért itt nincs külön szóvégi határ.
 */
const STRONG_HU: string[] = [
  `szex(?!i)[${HUL}]*`, // szex, szexuális, szexjáték – de a "szexi" (jelző) nem
  `erotik[${HUL}]*`,
  `porn[${HUL}]*`,
  `maszturb[${HUL}]*`,
  `onáni[${HUL}]*|onaniz[${HUL}]*`,
  `dild[${HUL}]*`,
  `vibrátor[${HUL}]*|vibrator[${HUL}]*`,
  `anál[${HUL}]*`,
  `bdsm[${HUL}]*`,
  `óvszer[${HUL}]*|ovszer[${HUL}]*`,
  `kondom[${HUL}]*`,
  `libid[${HUL}]*`,
  `csikló[${HUL}]*`,
  `pénisz[${HUL}]*|penisz[${HUL}]*`,
  `fallosz[${HUL}]*`,
  `mellbimb[${HUL}]*`,
  `szemérem[${HUL}]*`,
  `nemi\\s*(?:szerv|vágy|aktus|beteg|szervek)[${HUL}]*`,
  `síkosító[${HUL}]*`,
  `fétis[${HUL}]*|fetis[${HUL}]*`,
  `orgazm[${HUL}]*`,
  `sperma[${HUL}]*`,
  `kéjvágy[${HUL}]*|kéjgép[${HUL}]*`,
  `felnőtt\\s*(?:tartalom|játék)[${HUL}]*`,
  `18\\s*\\+`,
];

/**
 * Angol minták (a terméknevek gyakran angolul szerepelnek). Ezeket TELJES
 * szóként illesztjük, hogy az "anal" ne találjon az "analóg"-ra.
 */
const STRONG_EN: string[] = [
  'sex',
  'sextoy',
  'sex-toy',
  'sexshop',
  'sexdoll',
  'sex-doll',
  'porn',
  'porno',
  'pornography',
  'erotic',
  'erotica',
  'vibrator',
  'dildo',
  'anal',
  'analplug',
  'buttplug',
  'butt-plug',
  'masturbator',
  'masturbation',
  'orgasm',
  'bdsm',
  'fleshlight',
  'onahole',
  'stroker',
  'fuck(?:er|ers|ing|ed|s)?',
  'pussy',
  'cockring',
  'cock-ring',
  'g-?spot',
  'nipple',
  'genital',
  'penis',
  'vagina',
  'clitoris',
  'condom',
];

/**
 * Gyenge minta súllyal. A súly az indikátor erősségét fejezi ki: a puszta
 * jelző ("szexi", "intim") 1 pont, a konkrétabb utalás ("nemi", "kegel",
 * "medencefenék") 2 pont.
 */
type WeakRule = { pattern: string; weight: number };

const WEAK_HU: WeakRule[] = [
  { pattern: `szexi[${HUL}]*`, weight: 1 },
  { pattern: `intim[${HUL}]*`, weight: 1 },
  { pattern: `kenőanyag[${HUL}]*`, weight: 1 },
  { pattern: `orális[${HUL}]*`, weight: 2 },
  { pattern: `nemi[${HUL}]*`, weight: 2 },
  { pattern: `kegel[${HUL}]*`, weight: 2 },
  { pattern: `medencefenék[${HUL}]*`, weight: 2 },
];

const WEAK_EN: WeakRule[] = [
  { pattern: 'sexy', weight: 1 },
  { pattern: 'intimate', weight: 1 },
  { pattern: 'sensual', weight: 1 },
  { pattern: 'lingerie', weight: 1 },
  { pattern: 'lubricant', weight: 1 },
  { pattern: 'kegel', weight: 2 },
  { pattern: 'adult-toy', weight: 2 },
];

// A magyar minták toldalékot is engednek, az angolok teljes szót kívánnak.
const WEAK_RULES: { pattern: string; weight: number; wholeWord: boolean }[] = [
  ...WEAK_HU.map((r) => ({ ...r, wholeWord: false })),
  ...WEAK_EN.map((r) => ({ ...r, wholeWord: true })),
];

// A szó eleji határ saját lookaround: a beépített szóhatár csak ASCII betűt
// ismer, így az
// "anál" / "anal" minta a "kanál"/"analóg" szavak belsejére nem illeszkedhet.
const beforeBoundary = `(?<![${HUL}0-9])`;
const afterBoundary = `(?![${HUL}0-9])`;

/**
 * A magyar minták saját magukban hozzák a toldalékot ([HUL]*), ezért csak a
 * szó elején horgonyzunk; az angol mintákat teljes szóként illesztjük.
 */
function prefixRegex(patterns: string[]): RegExp {
  return new RegExp(`${beforeBoundary}(?:${patterns.join('|')})`, 'gi');
}

function wholeWordRegex(patterns: string[]): RegExp {
  return new RegExp(`${beforeBoundary}(?:${patterns.join('|')})${afterBoundary}`, 'gi');
}

const STRONG_RES: RegExp[] = [prefixRegex(STRONG_HU), wholeWordRegex(STRONG_EN)];

function findMatches(regexps: RegExp[], text: string): string[] {
  const found = new Set<string>();
  for (const re of regexps) {
    re.lastIndex = 0; // a /g regexp lastIndex-e megmarad - mindig nullázuk
    for (const m of text.matchAll(re)) found.add(m[0].toLowerCase());
  }
  return [...found];
}

/**
 * Gyenge jelzések gyűjtése: minden EGYEDI talált szóhoz tartozik egy súly
 * (a találat szövege a kulcs, így ugyanaz a szó csak egyszer számít).
 */
function collectWeak(text: string): Map<string, number> {
  const found = new Map<string, number>();
  for (const rule of WEAK_RULES) {
    const re = rule.wholeWord
      ? wholeWordRegex([rule.pattern])
      : prefixRegex([rule.pattern]);
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const key = m[0].toLowerCase();
      if (!found.has(key)) found.set(key, rule.weight);
    }
  }
  return found;
}

export type AdultContentInput = {
  slug?: string | null;
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  productName?: string | null;
  productBrand?: string | null;
  /** Címkék: string-tömb vagy a Prisma PostTag-reláció ({ tag: { name } }). */
  tags?: readonly (string | { tag: { name: string } })[] | null;
  category?: { name?: string | null; slug?: string | null } | string | null;
};

/**
 * Kézi felülírás: ide sorolt slugoknál a kulcsszó-felismeréstől függetlenül
 * 18+ kapu jelenik meg. Akkor hasznos, ha egy cikk szexuális jellegű, de a
 * szövege nem tartalmaz egyértelmű kulcsszót.
 */
export const MANUAL_ADULT_SLUGS: readonly string[] = [];

/**
 * Kézi kivétel: ezeknél a slugoknál SOHA nem jelenik meg a kapu, akkor sem, ha
 * a kulcsszavak találnak.
 */
export const MANUAL_SAFE_SLUGS: readonly string[] = [];

function tagNames(tags: AdultContentInput['tags']): string {
  if (!tags) return '';
  return tags
    .map((t) => (typeof t === 'string' ? t : t?.tag?.name ?? ''))
    .filter(Boolean)
    .join(' ');
}

function categoryText(category: AdultContentInput['category']): string {
  if (!category) return '';
  return typeof category === 'string' ? category : [category.name, category.slug].filter(Boolean).join(' ');
}

export type AdultContentResult = {
  isAdult: boolean;
  /** Gyenge-jelzések pontszáma (cím-súly 3, szöveg-súly 1). */
  score: number;
  /** A talált kulcsszavak (naplózáshoz / adminisztrációs áttekintéshez). */
  matches: string[];
  /** Melyik szabály döntött: "strong" | "weak" | "manual" | "safe" | "none". */
  reason: 'strong' | 'weak' | 'manual' | 'safe' | 'none';
};

/**
 * Eldönti, hogy egy blogbejegyzés szexuális jellegű-e. A cím, az összefoglaló,
 * a terméknév/márka, a címkék és a kategória "erős" jelzésnek számítanak
 * (ezek a felhasználóhoz legközelebbi metaadatok), a törzsszöveg találatai
 * gyengébb súlyúak.
 */
export function detectAdultContent(input: AdultContentInput): AdultContentResult {
  const slug = input.slug?.trim();
  if (slug && MANUAL_SAFE_SLUGS.includes(slug)) {
    return { isAdult: false, score: 0, matches: [], reason: 'safe' };
  }
  if (slug && MANUAL_ADULT_SLUGS.includes(slug)) {
    return { isAdult: true, score: 99, matches: [], reason: 'manual' };
  }

  const headline = [
    input.title,
    input.excerpt,
    input.productName,
    input.productBrand,
    tagNames(input.tags),
    categoryText(input.category),
  ]
    .filter(Boolean)
    .join(' \n ');
  const body = input.content ?? '';

  const strong = findMatches(STRONG_RES, `${headline} \n ${body}`);
  if (strong.length > 0) {
    return { isAdult: true, score: 10, matches: strong, reason: 'strong' };
  }

  // A cím/metaadatok találata háromszoros súllyal számít a törzsszöveghez képest.
  const weakHeadline = collectWeak(headline);
  const weakBody = collectWeak(body);
  let score = 0;
  for (const [word, weight] of weakHeadline) score += weight * 3;
  const bodyOnly = [...weakBody.entries()].filter(([word]) => !weakHeadline.has(word));
  for (const [, weight] of bodyOnly) score += weight;
  const matches = [...weakHeadline.keys(), ...bodyOnly.map(([word]) => word)];

  return {
    isAdult: score >= ADULT_WEAK_THRESHOLD,
    score,
    matches,
    reason: matches.length > 0 ? 'weak' : 'none',
  };
}

/** Rövid kényelmi burkoló: csak az igen/nem válasz kell (listákhoz, kapuhoz). */
export function isAdultContent(input: AdultContentInput): boolean {
  return detectAdultContent(input).isAdult;
}

/** A böngészőben beállítandó elfogadás-süti (a kliens-panel használja). */
export function adultConsentCookieString(secure: boolean): string {
  return [
    `${ADULT_CONSENT_COOKIE}=${ADULT_CONSENT_VALUE}`,
    'path=/',
    `max-age=${ADULT_CONSENT_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** Igaz, ha a kérésben már ott van az érvényes korhatár-elfogadás. */
export function hasAdultConsent(cookieValue: string | undefined | null): boolean {
  return cookieValue === ADULT_CONSENT_VALUE;
}
