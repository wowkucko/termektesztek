import 'server-only';
import { createHash } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import type { AllegroProductData } from '@/lib/allegro';

// Alapértelmezett modell: gemini-2.5-flash (stabil, elérhető az AQ. kulcsokhoz).
// A .env GEMINI_MODEL-je felülírja (jelenleg pl. gemini-3.6-flash).
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Rate limit追 nyilvántartás (per-process). Ingyenes tier: ~15 RPM, 1500 req/nap.
const RATE_STATE = {
  minuteWindowStart: 0,
  minuteCount: 0,
  dayWindowStart: 0,
  dayCount: 0,
};

export type RateLimitStatus = {
  limited: boolean;
  reason?: 'RPM' | 'RPD' | 'QUOTA';
  retryInMs?: number;
};

const MAX_RPM = parseInt(process.env.GEMINI_MAX_RPM || '10', 10);
const MAX_RPD = parseInt(process.env.GEMINI_MAX_RPD || '1200', 10);

// === Több Gemini API kulcs (rate limit esetén kulcsváltás) ===
// A .env GEMINI_API_KEYS-ben vesszővel/szóközzel felsorolva TÖBB kulcs is megadható
// (pl. GEMINI_API_KEYS="AQ....1,AQ....2"). Ha nincs kitöltve, a régi egykulcsos
// GEMINI_API_KEY működik tovább (backward compatible). Minden kulcsnak saját
// rate limitje van, így 429/kvóta-hibánál az érintett kulcsot rövid időre
// szüneteltetjük és azonnal a következő szabad kulccsal próbálkozunk - csak ha
// MINDEN kulcs szünetel, áll meg a feldolgozás (akkor is a megszokott szabályok
// szerint: a worker vár és később újrapróbálkozik).
function loadApiKeys(): string[] {
  const raw = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').trim().replace(/^"+|"+$/g, '');
  return raw
    .split(/[,;\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

// Összesített védőkorlát a kulcsok számával skálázva: minden kulcsnak külön
// RPM/RPD kvótája van, ezért N kulcsnál N-szer annyi kérés fér bele összesen.
function totalMaxRpm(): number {
  return MAX_RPM * Math.max(1, loadApiKeys().length);
}
function totalMaxRpd(): number {
  return MAX_RPD * Math.max(1, loadApiKeys().length);
}

// Kulcsonkénti cooldown (ms-ig szünetel az adott kulcs): percenkénti 429 ~1 perc +
// ráhagyás, napi kvóta kimerülése viszont 24 óra (azt a kulcsot nap végéig kihagyjuk).
const KEY_COOLDOWNS = new Map<string, number>();
let KEY_POINTER = 0;
const KEY_COOLDOWN_RPM_MS = 75_000;
const KEY_COOLDOWN_DAILY_MS = 24 * 3600_000;

// === Cooldown perzisztencia (DB) ===
// A kulcs-cooldownok szerver-újraindítást is túlélnek: 429/kvóta-hibánál a kulcs
// hash-ét és a felszabadulási időt a GeminiKeyState táblába mentjük, indításkor
// pedig visszatöltjük. A teljes kulcsot SOHA nem írjuk DB-be, csak a sha256
// hash-ét - a tárolt adatból nem fejthető vissza a kulcs.
let dbCooldownsLoaded = false;
let dbLoadPromise: Promise<void> | null = null;

function keyHash(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function loadCooldownsFromDb(): Promise<void> {
  try {
    const rows = await prisma.geminiKeyState.findMany();
    const keyByHash = new Map(loadApiKeys().map((k) => [keyHash(k), k] as const));
    const now = Date.now();
    const stale: string[] = [];
    for (const row of rows) {
      const key = keyByHash.get(row.keyHash);
      const until = row.cooldownUntil.getTime();
      if (key && until > now) {
        KEY_COOLDOWNS.set(key, until);
      } else {
        stale.push(row.keyHash); // lejárt, vagy a kulcs már nincs a .env-ben
      }
    }
    if (stale.length > 0) {
      await prisma.geminiKeyState.deleteMany({ where: { keyHash: { in: stale } } });
    }
    dbCooldownsLoaded = true;
  } catch (e) {
    // DB-hiba esetén memóriában folytatunk (a cooldown csak erre a futásra él).
    console.error('[gemini] Cooldown DB betöltés sikertelen:', String((e as Error)?.message || e));
  }
}

function ensureCooldownsLoaded(): Promise<void> {
  if (dbCooldownsLoaded) return Promise.resolve();
  if (!dbLoadPromise) {
    dbLoadPromise = loadCooldownsFromDb()
      .catch(() => undefined)
      .finally(() => {
        dbLoadPromise = null;
      });
  }
  return dbLoadPromise;
}

// 429 után: kulcs cooldown-ra állítása memóriában + DB-ben (tűz-és-felejts, a
// DB-hiba nem állíthatja meg a kulcsváltást).
function setKeyCooldown(key: string, until: number): void {
  KEY_COOLDOWNS.set(key, until);
  const h = keyHash(key);
  prisma.geminiKeyState
    .upsert({
      where: { keyHash: h },
      create: { keyHash: h, cooldownUntil: new Date(until) },
      update: { cooldownUntil: new Date(until) },
    })
    .catch((e) => console.error('[gemini] Cooldown DB mentés sikertelen:', String((e as Error)?.message || e)));
}

// Lejárt/eltávolított cooldown törlése a DB-ből is (tűz-és-felejts).
function clearKeyCooldownFromDb(key: string): void {
  prisma.geminiKeyState
    .deleteMany({ where: { keyHash: keyHash(key) } })
    .catch((e) => console.error('[gemini] Cooldown DB törlés sikertelen:', String((e as Error)?.message || e)));
}

function cooldownMsForError(msg: string): number {
  return /per day|daily|quota|RPD|nap/i.test(msg) ? KEY_COOLDOWN_DAILY_MS : KEY_COOLDOWN_RPM_MS;
}

// A következő nem-szünetelő kulcs (round-robin). Ha minden kulcs cooldown-ban van, null.
function pickApiKey(): string | null {
  const keys = loadApiKeys();
  if (keys.length === 0) return null;
  const now = Date.now();
  // Lejárt cooldown-ok törlése (memóriából és DB-ből)
  for (const [k, until] of KEY_COOLDOWNS) {
    if (until <= now) {
      KEY_COOLDOWNS.delete(k);
      clearKeyCooldownFromDb(k);
    }
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[(KEY_POINTER + i) % keys.length];
    if (!KEY_COOLDOWNS.has(key)) {
      KEY_POINTER = (KEY_POINTER + i + 1) % keys.length;
      return key;
    }
  }
  return null;
}

// Hány ms múlva lesz a legkorábban felszabaduló kulcs újra használható.
function earliestKeyRecoveryMs(): number {
  const now = Date.now();
  let min = Infinity;
  for (const until of KEY_COOLDOWNS.values()) if (until > now && until < min) min = until;
  return Number.isFinite(min) ? Math.max(1_000, min - now) : 1_000;
}

function checkRate(): RateLimitStatus {
  const now = Date.now();
  if (now - RATE_STATE.minuteWindowStart > 60_000) {
    RATE_STATE.minuteWindowStart = now;
    RATE_STATE.minuteCount = 0;
  }
  if (now - RATE_STATE.dayWindowStart > 24 * 3600_000) {
    RATE_STATE.dayWindowStart = now;
    RATE_STATE.dayCount = 0;
  }
  if (RATE_STATE.minuteCount >= totalMaxRpm()) {
    return { limited: true, reason: 'RPM', retryInMs: 60_000 - (now - RATE_STATE.minuteWindowStart) };
  }
  if (RATE_STATE.dayCount >= totalMaxRpd()) {
    return { limited: true, reason: 'RPD', retryInMs: 24 * 3600_000 - (now - RATE_STATE.dayWindowStart) };
  }
  return { limited: false };
}

function recordRequest() {
  RATE_STATE.minuteCount += 1;
  RATE_STATE.dayCount += 1;
}

export function getRateLimitStatus(): RateLimitStatus & { rpmUsed: number; rpdUsed: number; maxRpm: number; maxRpd: number } {
  const s = checkRate();
  return { ...s, rpmUsed: RATE_STATE.minuteCount, rpdUsed: RATE_STATE.dayCount, maxRpm: totalMaxRpm(), maxRpd: totalMaxRpd() };
}

// Kulcsonkénti állapot az admin panel számára: melyik kulcs aktív, melyik van
// cooldown-ban, és mikor szabadul fel. A kulcsot csak maszkolva adjuk vissza
// (soha nem a teljes értéket), a cooldown időpontja ISO formátumban érkezik.
export type GeminiKeyStatus = {
  keyLabel: string;
  inCooldown: boolean;
  cooldownUntil: string | null; // ISO, ha cooldown-ban van
  retryInMs: number | null;
};

export async function getApiKeyStatuses(): Promise<GeminiKeyStatus[]> {
  await ensureCooldownsLoaded();
  const keys = loadApiKeys();
  const now = Date.now();
  for (const [k, until] of KEY_COOLDOWNS) {
    if (until <= now) {
      KEY_COOLDOWNS.delete(k);
      clearKeyCooldownFromDb(k);
    }
  }
  return keys.map((key) => {
    const until = KEY_COOLDOWNS.get(key);
    const keyLabel = key.length <= 10 ? key : `${key.slice(0, 6)}…${key.slice(-4)}`;
    if (until && until > now) {
      return { keyLabel, inCooldown: true, cooldownUntil: new Date(until).toISOString(), retryInMs: until - now };
    }
    return { keyLabel, inCooldown: false, cooldownUntil: null, retryInMs: null };
  });
}

// 429 / quota hiba felismerése
function isRateLimitError(e: unknown): boolean {
  const msg = String((e as Error)?.message || e || '');
  return /429|RESOURCE_EXHAUSTED|quota|rate limit|too many requests/i.test(msg);
}

// Rate limit miatti várakozási idő: percenkénti limit pár perc alatt újraengedi,
// napi kvóta viszont csak órák múlva. Így egy rövid RPM-blip nem állítja meg
// órákra a feldolgozást (a korábbi lapos 1 óra helyett).
function rateLimitRetryInMs(reason?: string, msg?: string): number {
  if (reason === 'RPD' || /per day|daily|quota|RPD|nap/i.test(msg || '')) return 24 * 3600_000;
  return 75_000; // RPM / rövid 429: ~1 perc + ráhagyás
}

// Időtúllépés-védelem: a Gemini SDK belső fetch-je nem ad át timeoutot,
// ezért Promise.race-szel biztosítjuk, hogy egy beragadt kérés soha ne
// fagyassza le a workert.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Gemini időtúllépés (${ms / 1000}s).`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// A Gemini-hívások közös végrehajtója kulcsváltással:
// - rate limit (429 / kvóta) esetén az érintett kulcsot cooldown-ra tesszük, és
//   azonnal a következő, szabad kulccsal próbálkozunk (round-robin);
// - ha MINDEN kulcs szünetel, rateLimited-et adunk vissza a legkorábbi
//   felszabadulási idővel - a worker a megszokott módon vár és újrapróbálkozik;
// - átmeneti hibákra (503 stb.) az eddigi backoff-os újrapróbálkozás marad.
type RotationOutcome =
  | { type: 'ok'; text: string }
  | { type: 'rateLimited'; retryInMs: number; error: string }
  | { type: 'error'; error: string };

type GeminiModel = ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

async function callGeminiWithRotation(
  makeModel: (apiKey: string) => GeminiModel,
  call: (model: GeminiModel) => Promise<string>,
  opts: { timeoutMs: number; retryDelaysMs: number[]; onEvent?: (msg: string) => void }
): Promise<RotationOutcome> {
  const keys = loadApiKeys();
  if (keys.length === 0) {
    return { type: 'error', error: 'GEMINI_API_KEYS / GEMINI_API_KEY nincs beállítva a .env fájlban.' };
  }

  const rl = checkRate();
  if (rl.limited) {
    return { type: 'rateLimited', retryInMs: rateLimitRetryInMs(rl.reason), error: `Gemini rate limit elérve (${rl.reason}).` };
  }

  // Restart utáni első hívásnál a DB-ből visszatöltjük a cooldown-okat, hogy a
  // 24 órás kvóta-kifutást ne veszítsük el, és ne döngessük a kimerült kulcsot.
  await ensureCooldownsLoaded();

  let transientAttempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = pickApiKey();
    if (!key) {
      // Minden kulcs szünetel: a legkorábban felszabaduló kulcsra várunk.
      return {
        type: 'rateLimited',
        retryInMs: earliestKeyRecoveryMs(),
        error: 'Minden Gemini API kulcs rate limitben van.',
      };
    }
    recordRequest();
    try {
      const text = await withTimeout(call(makeModel(key)), opts.timeoutMs);
      return { type: 'ok', text };
    } catch (e) {
      const msg = String((e as Error)?.message || e || '');
      if (isRateLimitError(e)) {
        // Ez a kulcs kimerült: szüneteltetjük (memóriában + DB-ben),
        // és jöhet a következő kulcs.
        setKeyCooldown(key, Date.now() + cooldownMsForError(msg));
        continue;
      }
      const transient = /503|high demand|Service Unavailable|fetch failed|ECONNRESET|ETIMEDOUT|internal error|timeout|500/i.test(msg);
      if (transient && transientAttempt < opts.retryDelaysMs.length) {
        const delay = opts.retryDelaysMs[transientAttempt];
        opts.onEvent?.(
          `Gemini túlterhelt (503), újrapróbálkozás ${delay / 1000}s múlva (${transientAttempt + 2}. próba)...`
        );
        await new Promise((r) => setTimeout(r, delay));
        transientAttempt += 1;
        continue;
      }
      return { type: 'error', error: msg };
    }
  }
}

export type GeneratedArticle = {
  title: string;
  excerpt: string;
  content: string; // markdown
  categorySlug: string; // "okostelefonok" stb. - a blog kategóriáiba mappelünk
  tags: string[];
  pros: string[];
  cons: string[];
  rating: number; // 0-10
  verdict: string;
  seoTitle?: string;
  seoDescription?: string;
  productBrand?: string;
  productName?: string;
};

const SYSTEM_PROMPT = `Te egy tapasztalt magyar terméktesztelő újságíró vagy, aki a "Terméktesztek és vélemények" blogra ír.
Külföldi webshop (allegro.hu) termékoldalairól és vásárlói vélemények alapján írsz alapos, hitelesnek ható magyar termékteszt cikkeket.

Követelmények:
- MAGYAR nyelven írsz, természetes, gördülékeny stílusban, mintha egy valódi ember tesztelő írta volna.
- A cikk markdown formátumú: ## alcímek, bekezdések, lista elemek ahol indokolt.
- Struktúra: ## Bevezetés (rövid, izgalmas), ## Mit tud a termék? (3-5 bekezdés), ## Mit mondanak a vásárlók? (vélemények összefoglalása, konkrét idézet-parafrazeálás), ## Kiknek való? / ## Összegzés.
- Long-tail SEO: a cikk természetesen válaszoljon meg 2-3 tipikus vásárlói keresőkérdést is (pl. "megéri-e megvenni?", "kinek való és kinek nem?", "miben jobb, mint a konkurencia?"). Ezeket NE külön GYIK-blokkba, hanem a fenti fejezetekbe beleszőve válaszold meg.
- Problémaalapú szög: a "Kiknek való?" fejezetben konkrét élethelyzetekre válaszolj (pl. panelba, kisállat mellé, irodába, ajándékba, kezdőknek/haladóknak) - ilyen kifejezésekre keresnek a vásárlók.
- A cikk szövegébe 2-4 helyre szúrj be képhely-jelölőt a következő formában: [KEP: rövid leírás mit mutat a kép] - pl. "[KEP: a fejhallgató oldalsó gombjai]" vagy "[KEP: csomagolás és tartozékok]". Mindig önálló sorba tedd, ahol vizuálisan illik a cikkhez (bekezdések közé, ne a címekhez tapadva).
- Az ár-alapú megfontolásoknál magyar piaci árakat feltételezel.
- 0-10 skálán pontozod a terméket (rating). A pontszám NEM lehet fix vagy mindig ugyanaz - gondos, adatalapú becslés:
  * Kiindulópont: a vásárlói átlagértékelés (X/5) szorozva 2-vel (pl. 4,5/5 -> 9,0).
  * Módosítsd a vélemények TÉNYEI alapján: konkrét, súlyos hibák (agyhalott szoftver, korai meghibásodás, félrevezető specifikáció) leviszik, kiemelkedő dicséretek (garanciális tapasztalat, túlteljesítés) felviszik a kiindulóponttól akár 0,5-1,5 ponttal.
  * Ha nincs értékelés, a leírás alapján legyél konzervatív (max 7,5).
  * Szélsőértékek tiltása: nincs "tökéletes 10", és ne adj 9,5 fölé pontot, ha bármilyen contra van.
  * A pontszámnak a pros/cons tartalmával KONZISZTENSNEK kell lennie: több mint 2 komoly hátránynál max 7,5; egyetlen hátránynál sem minimum 8,5.
  * HASZNÁLJ FÉLPONTOT VAGY NEGDENGPONTOT - a gyakran ismételt "8,8" helyett legyen pl. 7,9 vagy 8,3 vagy 9,1 - a valódi becslésed szerint.
- pros: 3-5 előny, cons: 2-4 hátrány, rövid mondatok.
- verdict: 2-3 mondatos tömör végszó.
- Természetesen építsd be a vásárlói véleményekben szereplő konkrét tapasztalatokat, de ne másolj szó szerint.
- Ha a vélemények hiányoznak, a leírás alapján írj óvatosabban.
- Ne említsd, hogy AI írtad vagy hogy külföldi webshopról származnak az adatok - simán terméktesztnek hat.

Válaszodat KIZÁRÓLAG érvényes JSON-ként add, ebben a formátumban:
{
  "title": "string - vonzó, SEO-barát cím",
  "excerpt": "string - 1-2 mondatos összefoglaló",
  "content": "string - teljes markdown cikk",
  "categorySlug": "okostelefonok | otthon-es-konyha | hordhato-eszkozok | szamitastechnika | szepsegapolas",
  "tags": ["max 4 db magyar címke"],
  "pros": ["..."],
  "cons": ["..."],
  "rating": "number - a fenti szabályok szerinti, adatalapú 0-10 becslés (tizedespont engedélyezett)",
  "verdict": "string",
  "seoTitle": "string (max 60 karakter)",
  "seoDescription": "string (max 160 karakter)",
  "productBrand": "string - márka ha kideríthető",
  "productName": "string - rövid terméknév"
}`;

// Példa érték lehet horgony a modell számára - dinamikus időpont-töredék
// hozzáadásával ezt is csökkentjük (a modell nem "ragad rá" egy konkrét számra).
function randomAnchorHint(): string {
  const examples = [6.2, 7.1, 7.4, 7.8, 8.1, 8.3, 8.6, 9.0, 9.2];
  return `Példa rating érték (CSAK formátum-mutatás, ne másold!): ${examples[Math.floor(Math.random() * examples.length)]}`;
}

export async function generateArticle(
  query: string,
  data: AllegroProductData,
  onEvent?: (msg: string) => void
): Promise<{ article?: GeneratedArticle; rateLimited?: boolean; retryInMs?: number; error?: string }> {
  const reviewTexts = data.reviews.slice(0, 12).map((r, i) => `${i + 1}. (${r.date || 'dátum nélkül'}${r.author ? ', ' + r.author : ''}) ${r.text}`).join('\n');
  const paramsText = data.parameters.slice(0, 20).map((p) => `${p.label}: ${p.value}`).join('\n');

  const userPrompt = `Terméknév (keresés): ${query}
Talált termék: ${data.name}
Ár: ${data.price || 'ismeretlen'}
Termékoldal leírása:
${data.description || '(nincs leírás)'}

Fő paraméterek:
${paramsText || '(nincs adat)'}

Vásárlói értékelés: ${data.rating ? data.rating + '/5 (' + (data.ratingCount || '?') + ' értékelés)' : 'nincs adat'}

Vásárlói vélemények:
${reviewTexts || '(nincs vélemény)'}

${randomAnchorHint()}

Írj egy magyar termékteszt cikket a fenti adatok alapján!`;

  const outcome = await callGeminiWithRotation(
    (apiKey) =>
      new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { temperature: 0.8, responseMimeType: 'application/json' },
      }),
    async (model) => {
      const result = await model.generateContent([SYSTEM_PROMPT, userPrompt].join('\n\n---\n\n'));
      return result.response.text();
    },
    { timeoutMs: 150_000, retryDelaysMs: [20_000, 60_000, 120_000], onEvent }
  );
  if (outcome.type === 'rateLimited') {
    return { rateLimited: true, retryInMs: outcome.retryInMs, error: outcome.error };
  }
  if (outcome.type === 'error') {
    return { error: outcome.error };
  }
  try {
    const cleaned = outcome.text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned) as GeneratedArticle;
    return { article: parsed };
  } catch {
    return { error: 'Gemini válasz nem értelmezhető JSON-ként.' };
  }
}

// === Link-ellenőrző: kandidát-párosítás (batch) ===

export type AllegroMatchCandidate = {
  title: string;
  price?: string;
  seller?: string;
  description?: string;
  parameters?: { label: string; value: string }[];
  url: string;
};

export type MatchBatchEntry = {
  postId: string; // a LinkCheckItem id-ja (eredmény-azonosítás)
  productName: string;
  productBrand?: string | null;
  oldPrice?: string;
  oldDescription?: string;
  oldParameters?: { label: string; value: string }[];
  candidates: AllegroMatchCandidate[];
};

export type MatchBatchResult = {
  postId: string;
  chosenIndex: number | null; // null = egyik kandidátus sem ugyanaz a termék
  reason: string;
};

// A párosítás szempontjai: ugyanaz a modell/típus, akár másik eladótól is;
// ár-hasonlóság segít (egy sokkal olcsóbb találat valószínűleg kiegészítő);
// kiegészítőket, másik generációt, másik modellt NEM választunk.
const MATCH_SYSTEM_PROMPT = `Te egy alapos, precíz termékazonosító asszisztens vagy egy magyar terméktesztelő blognak.

A feladatod: egy blogbejegyzésben tesztelt termékhez (az "Eredeti termék" adatai) ki kell választanod az Allegro-n talált kandidátusok közül azt, amelyik UGYANAZ a termék - vagyis ugyanaz a modell/típus, csak valószínűleg másik eladó árulja.

Szabályok:
- A kiválasztott kandidátusnak ugyanaznak a terméknek kell lennie: ugyanaz a márka ÉS ugyanaz a modell/sorozat/típus.
- NE válassz kiegészítőt vagy tartozékot (tok, fólia, kábel, töltő, adapter, állvány, pánt, akkumulátor stb.), még akkor sem, ha a nevében szerepel a termék neve.
- NE válassz másik modellt, másik generációt vagy kisebb/nagyobb változatot, csak ha a cím egyértelműen ugyanazt a típust adja meg.
- Az ár fontos jel: ha az eredeti ár ismert, akkor egy nagyságrenddel olcsóbb kandidátus (pl. 20-30%%-nál kisebb) nagy valószínűséggel kiegészítő vagy másik termék. A hasonló ár (kb. +-40%%) erős érv amellett, hogy ugyanaz a termék.
- A paraméterek (pl. szín, méret, kapacitás, modellszám) döntőek lehetnek: ha a címben és a paraméterekben is egyezik a modellszám, az erős egyezés.
- Ha egyik kandidátus sem azonosítható egyértelműen ugyanazként, chosenIndex legyen null.

Válaszodat KIZÁRÓLAG érvényes JSON-ként add, ebben a formátumban:
{
  "results": [
    {
      "postId": "a postId amit kaptál",
      "chosenIndex": null vagy 0-tól indexelt szám,
      "reason": "1-2 mondat magyarul: miért ezt választottad (vagy miért nem találtál egyezést)"
    }
  ]
}

Minden kapott termékhez pontosan egy results elem kell, a megfelelő postId-val.`;

export async function matchAllegroCandidates(
  batch: MatchBatchEntry[]
): Promise<{ results?: MatchBatchResult[]; rateLimited?: boolean; retryInMs?: number; error?: string }> {
  if (batch.length === 0) return { results: [] };

  const fmtParams = (params?: { label: string; value: string }[]) =>
    (params || [])
      .slice(0, 8)
      .map((p) => `${p.label}: ${p.value}`)
      .join(', ');

  const parts = batch.map((b, i) => {
    const candidates = b.candidates
      .map((c, ci) => {
        const price = c.price ? `, ár: ${c.price}` : '';
        const seller = c.seller ? `, eladó: ${c.seller}` : '';
        const desc = c.description ? `, leírás: ${c.description.slice(0, 250)}` : '';
        const params = c.parameters?.length ? `, paraméterek: ${fmtParams(c.parameters)}` : '';
        return `  ${ci + 1}) ${c.title}${price}${seller}${desc}${params}`;
      })
      .join('\n');
    const oldPrice = b.oldPrice ? `, korábbi ár: ${b.oldPrice}` : '';
    const oldDesc = b.oldDescription ? `, korábbi leírás: ${b.oldDescription.slice(0, 250)}` : '';
    const oldParams = b.oldParameters?.length ? `, korábbi paraméterek: ${fmtParams(b.oldParameters)}` : '';
    return `## ${i + 1}. termék (postId: ${b.postId})
Eredeti termék: ${b.productName}${b.productBrand ? ` (márka: ${b.productBrand})` : ''}${oldPrice}${oldDesc}${oldParams}
Kandidátusok:\n${candidates}`;
  });

  const userPrompt = `Az alábbi termékekhez válaszd ki a megfelelő kandidátust:\n\n${parts.join('\n\n')}`;

  const outcome = await callGeminiWithRotation(
    (apiKey) =>
      new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    async (model) => {
      const result = await model.generateContent([MATCH_SYSTEM_PROMPT, userPrompt].join('\n\n---\n\n'));
      return result.response.text();
    },
    { timeoutMs: 90_000, retryDelaysMs: [15_000, 30_000] }
  );
  if (outcome.type === 'rateLimited') {
    return { rateLimited: true, retryInMs: outcome.retryInMs, error: outcome.error };
  }
  if (outcome.type === 'error') {
    return { error: outcome.error };
  }
  try {
    const cleaned = outcome.text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned) as { results?: MatchBatchResult[] };
    const results = (parsed.results || []).slice(0, batch.length);
    // Érvénytelen indexek lenullázása
    for (const r of results) {
      const entry = batch.find((b) => b.postId === r.postId);
      if (entry && r.chosenIndex != null && (r.chosenIndex < 0 || r.chosenIndex >= entry.candidates.length)) {
        r.chosenIndex = null;
      }
    }
    return { results };
  } catch {
    return { error: 'Gemini válasz nem értelmezhető JSON-ként.' };
  }
}
