import 'server-only';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.PUPPETEER_EXECUTABLE_PATH || '',
  process.env.PUPPETEER_CHROME_PATH || '',
].filter(Boolean);

const USER_DATA_DIR = process.env.ALLEGRO_PROFILE_DIR || 'C:\\Users\\Tomi\\AppData\\Local\\Temp\\opencode\\pptr-allegro-profile';

function findChrome(): string {
  for (const p of CHROME_PATHS) {
    try {
      // sync exists check via require to avoid async import
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs') as typeof import('fs');
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  throw new Error('Nem található Chrome. Állítsd be a PUPPETEER_EXECUTABLE_PATH env változót.');
}

export type AllegroReview = {
  date?: string;
  author?: string;
  rating?: number;
  text: string;
};

export type AllegroProductData = {
  name: string;
  url: string;
  price?: string;
  description: string;
  parameters: { label: string; value: string }[];
  rating?: number;
  ratingCount?: number;
  reviews: AllegroReview[];
  images: string[];
};

export type AllegroSearchCandidate = {
  title: string;
  price?: string;
  seller?: string;
  url: string;
};

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: findChrome(),
      headless: false,
      userDataDir: USER_DATA_DIR,
      args: [
        '--window-size=1280,900',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
      defaultViewport: null,
    });
  }
  const b = await browserPromise;
  if (!b || !b.connected) {
    browserPromise = puppeteer.launch({
      executablePath: findChrome(),
      headless: false,
      userDataDir: USER_DATA_DIR,
      args: [
        '--window-size=1280,900',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
      defaultViewport: null,
    });
  }
  return browserPromise;
}

export async function closeAllegroBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b) await b.close().catch(() => {});
    browserPromise = null;
  }
}

async function newPage(): Promise<Page> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  return page;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function isCaptcha(page: Page): Promise<boolean> {
  const html = await page.content();
  return html.includes('captcha-delivery');
}

async function waitForNotCaptcha(page: Page, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isCaptcha(page))) return true;
    await sleep(3000);
  }
  return !(await isCaptcha(page));
}

// Magyar gyakori termékszavak -> angol megfelelő (az Allegro nem mindig talál magyar kategórianévre)
const HU_TO_EN: Record<string, string> = {
  'egér': 'mouse',
  'eger': 'mouse',
  'porszívó': 'vacuum cleaner',
  'porszivo': 'vacuum cleaner',
  'fejhallgató': 'headphones',
  'fejhallgato': 'headphones',
  'okostelefon': 'smartphone',
  'telefon': 'phone',
  'okosóra': 'smartwatch',
  'okosora': 'smartwatch',
  'televízió': 'tv',
  'televizio': 'tv',
  'laptop': 'laptop',
  'monitor': 'monitor',
  'billentyűzet': 'keyboard',
  'billentyuzet': 'keyboard',
  'kávégép': 'coffee machine',
  'kavegep': 'coffee machine',
  'kávéfőző': 'coffee maker',
  'kavefozo': 'coffee maker',
  'robotporszívó': 'robot vacuum',
  'robotporszivo': 'robot vacuum',
  'kenyérsütő': 'toaster',
  'kenyersuto': 'toaster',
  'hajszárító': 'hair dryer',
  'hajszarito': 'hair dryer',
  'borotva': 'shaver',
  'foglkrém': 'toothbrush',
  'epilátor': 'epilator',
  'ventilátor': 'fan',
  'ventilator': 'fan',
  'konyhai robotgép': 'food processor',
  'légtesztelő': 'air quality monitor',
  'vaku': 'flash',
  'töltő': 'charger',
  'tolto': 'charger',
  'tápellátás': 'power bank',
  'akku': 'battery',
  'kábel': 'cable',
  'kabel': 'cable',
  'hangszóró': 'speaker',
  'hangszoro': 'speaker',
  'fülhallgató': 'earbuds',
  'fulhallgato': 'earbuds',
};

// Ékezetes karakterek ASCII-re cserélése (biztonsági háló: az Allegro kereső
// néha furán viselkedik ékezetes URL-ekkel - írd át: é->e, ű->u stb.)
function deaccent(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ő/g, 'o')
    .replace(/Ő/g, 'O')
    .replace(/ű/g, 'u')
    .replace(/Ű/g, 'U')
    .replace(/[^a-zA-Z0-9\s\-+]/g, ' ');
}

// Kisbetűs, ékezet nélküli, szavakra bontásra alkalmas normalizálás -
// a kandidát-rangsoroláshoz és az él/halott link összehasonlításhoz.
export function normalizeForMatch(text: string): string {
  return deaccent(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s\-+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "12 999 Ft" / "1 299,99 zł" / "1299.99" -> szám. A pont ezres-elválasztóként,
// a vessző tizedes-elválasztóként értelmezett (magyar/lengyel formátum).
export function parseNumericPrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/\u00a0/g, ' ').match(/(\d[\d\s.,]*)/);
  if (!m) return null;
  const cleaned = m[1].replace(/[\s.]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseFt(text: string): string | undefined {
  const m = text.replace(/\u00a0/g, ' ').match(/(\d[\d\s.]*\s?Ft)/);
  return m ? m[1].trim() : undefined;
}

// Keresési query előkészítése:
// 1. magyar termékszavak angolra cserélése (az Allegro katalógusa gyakran angol neveken van)
// 2. minden ékezet ASCII-re cserélése (URL-encoding biztonság)
export function prepareSearchQuery(query: string): string {
  let q = query.trim();
  // "teszt" szavak eltávolítása (a kereséshez zavaróak)
  q = q.replace(/\bteszt\b/gi, '').trim();
  // magyar szavak cseréje (ékezetes és ékezet nélküli kulcsokra is matchelünk)
  const deacc = deaccent(q).toLowerCase();
  for (const [hu, en] of Object.entries(HU_TO_EN)) {
    const huDeacc = deaccent(hu).toLowerCase();
    const re = new RegExp(`(^|\\s)${huDeacc}(\\s|$)`, 'g');
    if (re.test(deacc)) {
      q = q.replace(re, `$1${en}$2`);
      break; // elég egy csere, a többit a márka-név viszi
    }
  }
  // Végül: minden megmaradt ékezet ASCII-re
  q = deaccent(q);
  return q.replace(/\s+/g, ' ').trim();
}

// Keresés a /kereses?string=... oldalon, visszaadja a legjobb találat URL-jét.
// A találatok közül a query-vel legjobban egyező címet választjuk (szó-átfedés alapján).
export async function allegroSearchProduct(query: string): Promise<string | null> {
  const page = await newPage();
  try {
    const prepared = prepareSearchQuery(query);
    const url = `https://allegro.hu/kereses?string=${encodeURIComponent(prepared)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await sleep(4000);
    if (!(await waitForNotCaptcha(page, 20000))) {
      throw new Error('DataDome captcha - nyisd meg a Chrome-ot és oldd meg kézzel, majd próbáld újra.');
    }
    const links = await page.evaluate(() => {
      const out: { href: string; title: string }[] = [];
      for (const a of document.querySelectorAll('a')) {
        const h = a.href || '';
        if (h.includes('/termek/') && h.includes('offerId=') && !out.some((o) => o.href === h)) {
          out.push({ href: h, title: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200) });
        }
      }
      return out;
    });
    if (links.length === 0) return null;

    // Szó-átfedés alapján pontozás: a query szavai közül hány szerepel a találat címében.
    const queryWords = query
      .toLowerCase()
      .replace('teszt', '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const stopWords = new Set(['készülékhez', 'készülékre', 'után', 'védőfóliával', 'tokkal', 'töltővel', 'ajándékba']);
    let best: { href: string; score: number } | null = null;
    for (const l of links.slice(0, 15)) {
      const title = l.title.toLowerCase();
      let score = 0;
      for (const w of queryWords) if (title.includes(w)) score += 1;
      // Akcesszóris szavak levétele
      if ([...stopWords].some((s) => title.includes(s))) score -= 2;
      if (!best || score > best.score) best = { href: l.href, score };
    }
    return best ? best.href : links[0].href;
  } finally {
    await page.close().catch(() => {});
  }
}

// Keresés a /kereses?string=... oldalon, visszaadja a top N kandidátust
// (cím, ár, eladó, URL) a link-ellenőrző párosításához.
export async function allegroSearchCandidates(query: string, count = 6): Promise<AllegroSearchCandidate[]> {
  const page = await newPage();
  try {
    const prepared = prepareSearchQuery(query);
    const url = `https://allegro.hu/kereses?string=${encodeURIComponent(prepared)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await sleep(4000);
    if (!(await waitForNotCaptcha(page, 20000))) {
      throw new Error('DataDome captcha a kereséskor - nyisd meg a Chrome-ot és oldd meg kézzel.');
    }
    const results = await page.evaluate(() => {
      const out: { href: string; title: string; price?: string; seller?: string }[] = [];
      const seen = new Set<string>();
      const priceRe = /(\d[\d\s.]*)\s*Ft/;
      const sellerRe = /(?:Eladó|Seller|Sprzedawca|Od sprzedawcy)[:\s]+([A-Za-z0-9][\w\s.\-]{1,50})/i;
      for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href*="/oferta/"], a[href*="/termek/"]')) {
        const h = a.href || '';
        if (seen.has(h)) continue;
        // Csak valódi ajánlat-linkek (offer id az URL-ben)
        if (!/offerid=|\d{8,}/i.test(h)) continue;
        seen.add(h);
        // A találat-kártya: az anchor legközelebbi article/offer konténere
        const container = a.closest('article, [data-role="offer"], [class*="offer"], [class*="box"]') || a;
        const titleEl = container.querySelector('h2, h3, [class*="title"]');
        const title = (titleEl?.textContent || a.getAttribute('title') || container.textContent || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 200);
        if (!title || title.length < 5) continue;
        const text = (container.textContent || '').replace(/\u00a0/g, ' ');
        const pm = text.match(priceRe);
        const sm = text.match(sellerRe);
        out.push({
          href: h,
          title,
          price: pm ? `${pm[1].trim()} Ft` : undefined,
          seller: sm ? sm[1].trim() : undefined,
        });
        if (out.length >= 30) break;
      }
      return out;
    });
    return results
      .slice(0, count)
      .map((r) => ({ title: r.title, price: r.price, seller: r.seller, url: r.href }));
  } finally {
    await page.close().catch(() => {});
  }
}

// Ellenőrzi, hogy egy Allegro ajánlat-URL még él-e (nem halt-e meg az ajánlat).
// A halott ajánlatoknál az Allegro figyelmeztető oldalt / h1 nélküli oldalt ad,
// vagy átirányít. Captcha esetén hibát dob (a hívó próbálkozásnak számolja).
export async function allegroCheckOfferAlive(url: string): Promise<{ alive: boolean; reason?: string; pageTitle?: string }> {
  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await sleep(3000);
    if (!(await waitForNotCaptcha(page, 20000))) {
      throw new Error('DataDome captcha a link ellenőrzésekor - nyisd meg a Chrome-ot és oldd meg kézzel.');
    }
    const finalUrl = page.url();
    const info = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';
      const body = (document.body?.textContent || '').replace(/\s+/g, ' ').slice(0, 4000);
      return { h1, body };
    });

    const deadMarkers = [
      'nie jest już aktywne',
      'nie jest juz aktywne',
      'ogłoszenie nie jest już aktywne',
      'ogloszenie nie jest juz aktywne',
      'nie znaleziono ogłoszenia',
      'nie znaleziono ogloszenia',
      'przedmiot nie jest już dostępny',
      'przedmiot nie jest juz dostepny',
      'ogłoszenie wygasło',
      'ogloszenie wygaslo',
      'strona nie istnieje',
      'a termék már nem elérhető',
      'a termék már nem érhető el',
      'a hirdetés már nem aktív',
      'a hirdetés lejárt',
      'a termék nem található',
      '404',
    ];
    const hay = `${info.h1} ${info.body}`.toLowerCase();
    for (const m of deadMarkers) {
      if (hay.includes(m)) return { alive: false, reason: m, pageTitle: info.h1 };
    }
    if (!info.h1 || info.h1.length < 3) {
      return { alive: false, reason: 'Nincs termékcím (h1) az oldalon.', pageTitle: info.h1 };
    }
    // Ha átirányították valahová, ahol nincs már ajánlat-azonosító -> halott
    if (!/offerid=|\/oferta\/|\/termek\//i.test(finalUrl)) {
      return { alive: false, reason: 'A link már nem ajánlat-oldalra mutat.', pageTitle: info.h1 };
    }
    return { alive: true, pageTitle: info.h1 };
  } finally {
    await page.close().catch(() => {});
  }
}

// Termékoldal adatainak kinyerése.
export async function allegroScrapeProduct(url: string): Promise<AllegroProductData> {
  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await sleep(3000);
    if (!(await waitForNotCaptcha(page, 20000))) {
      throw new Error('DataDome captcha a termékoldalon.');
    }

    // Alapadatok
    const name = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() || '');

    // Ár - a "Ft"-ra végződő legelső nagy szöveg
    const price = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = (node.textContent || '').trim().replace(/\u00a0/g, ' ');
        if (/^\d[\d\s.]*\s?(Ft|ft)$/.test(t)) return t;
      }
      return null;
    });

    // Leírás
    const description = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-box-name="Description"], [data-box-name*="Description"]')) {
        const t = (el.textContent || '').trim();
        if (t.length > 100) return t.replace(/\s+/g, ' ').slice(0, 6000);
      }
      for (const el of document.querySelectorAll('h2, h3')) {
        const t = (el.textContent || '').trim().toLowerCase();
        if (t.includes('leírás')) {
          let parent = el.parentElement;
          for (let i = 0; i < 3 && parent; i++) {
            const txt = (parent.textContent || '').trim();
            if (txt.length > 100) return txt.replace(/\s+/g, ' ').slice(0, 6000);
            parent = parent.parentElement;
          }
        }
      }
      return '';
    });

    // Paraméterek (spec táblázat)
    const parameters = await page.evaluate(() => {
      const out: { label: string; value: string }[] = [];
      for (const table of document.querySelectorAll('table')) {
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2 || rows.length > 60) continue;
        for (const row of rows) {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const label = (cells[0].textContent || '').trim();
            const value = (cells[1].textContent || '').trim().replace(/\s+/g, ' ');
            if (label && value && label.length < 80 && value.length < 300 && label !== value) {
              out.push({ label, value: value.slice(0, 250) });
            }
          }
        }
        if (out.length >= 25) break;
      }
      return out;
    });

    // Képek: CSAK a termék saját galériájából, normalizálva (mindig /original/
    // felbontás) és deduplikálva a méret-változatokat. Több konténer-szelektort és
    // srcset/data-attr forrásokat is próbálunk, hogy a lazyloadolt képek se vesszenek el.

    // A galéria bepozicionálása + lazyload képek betöltésre várása, hogy a
    // naturalWidth-alapú szűrők ne dobják el a még nem betöltött képeket.
    await page.evaluate(() => {
      const g = document.querySelector('[data-box-name*="allery" i], [class*="gallery" i], [data-role*="gallery" i]');
      if (g) (g as HTMLElement).scrollIntoView({ block: 'center' });
    }).catch(() => {});
    await sleep(800);
    try {
      await page.waitForFunction(
        () => {
          const imgs = [...document.querySelectorAll('img')];
          return imgs.some((i) => (i.src || '').includes('allegroimg.com') && (i.naturalWidth || 0) > 100);
        },
        { timeout: 6000 }
      );
    } catch {
      // nincs betöltött allegroimg - a fallback logika úgyis megpróbálja
    }

    const images = await page.evaluate(() => {
      const isAllegroImg = (u: string) => u && u.includes('allegroimg.com');
      // A srcset-ből a legnagyobb felbontást választjuk (lazyload miatt az img.src
      // sokszor csak egy kis előnézet); emellett data-* attribútumokat is nézünk.
      const bestSrc = (img: HTMLImageElement): string => {
        const sset = img.getAttribute('srcset') || '';
        let best = '';
        let bestW = 0;
        for (const part of sset.split(',')) {
          const [u, w] = part.trim().split(/\s+/);
          if (!u) continue;
          const wNum = parseInt((w || '').replace(/w$/i, ''), 10) || 0;
          if (wNum >= bestW) {
            best = u;
            bestW = wNum;
          }
        }
        return (
          best ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-lazy-src') ||
          img.getAttribute('data-original') ||
          img.currentSrc ||
          img.src ||
          ''
        );
      };

      let raw: string[] = [];
      const seenBase = new Set<string>();
      // Fotó-besorolás: a host utáni teljes útvonal az egyedi kulcs (a méret-szegmens
      // kivételével), így az /s128/ bélyegkép, az /s720/ slide és az /original/ ugyanarra
      // a fotóra mutató változatai egyetlen URL-ré olvadnak össze - méret-szegmenstől
      // függetlenül. (A régi, 2-szegmensre épülő matcher a mai /dir/id/filename
      // felépítésű Allegro URL-eket rendre eldobta - ezert lett 0 kep minden scrapenel.)
      const push = (img: HTMLImageElement) => {
        const src = bestSrc(img);
        if (!isAllegroImg(src)) return;
        // UI-ikonok (pl. action-common-arrowhead nyilak) kiszűrése: betöltött kép, de
        // kisebb mint 50px, vagy a fájlnévben "action" szerepel
        const w = img.naturalWidth || img.width || 0;
        if ((w > 0 && w < 50) || /\/action-/.test(src)) return;
        // Normalizalas: a meret-szegmens (pl. /s128/, /s720/) helyere /original/ kerul,
        // igy a bélyegképekből is nagy felbontású fotó URL-t kapunk
        let norm = src.split('?')[0];
        norm = norm.replace(/\/(s\d+)\//, '/original/');
        const m = norm.match(/allegroimg\.com\/(.+)$/);
        if (!m) return;
        if (seenBase.has(m[1])) return; // ugyanaz a foto mas meretben - duplikatum!
        seenBase.add(m[1]);
        raw.push(norm);
      };

      const collectFrom = (root: Element | Document, minWidth: number) => {
        for (const img of root.querySelectorAll('img')) {
          const w = img.naturalWidth || img.width || 0;
          if (minWidth > 0 && w < minWidth) continue;
          push(img as HTMLImageElement);
        }
      };

      // 1. Preferált: galéria-konténerek (több ismert elnevezés, eset-érzéketlenül)
      const containerSel = [
        '[data-box-name*="allery" i]',
        '[data-box-name*="photo" i]',
        '[data-box-name*="media" i]',
        '[data-role*="gallery" i]',
        '[class*="gallery" i]',
        '[class*="offer-media" i]',
      ];
      const containers = [...new Set(containerSel.flatMap((s) => [...document.querySelectorAll(s)]))];
      if (containers.length) {
        for (const c of containers) collectFrom(c, 0);
      } else {
        // Fallback: egesz oldal, de a "mas eladok / ajanlott" kontenerek kihagyasa
        for (const img of document.querySelectorAll('img')) {
          const s = bestSrc(img);
          if (!isAllegroImg(s)) continue;
          const w = img.naturalWidth || img.width || 0;
          if (w < 150) continue;
          // Kihagyjuk a karusszel/ajanlo dobozokat
          let p: Element | null = img;
          let inReco = false;
          for (let i = 0; i < 6 && p; i++) {
            const bn = p.getAttribute?.('data-box-name') || '';
            if (/reco|carousel|other.?offer|all.?sellers|compatib|last.?viewed|similar/i.test(bn)) { inReco = true; break; }
            p = p.parentElement;
          }
          if (!inReco) push(img as HTMLImageElement);
        }
      }
      return raw.slice(0, 8);
    });

    // Értékelés száma + vélemények megnyitása
    let rating: number | undefined;
    let ratingCount: number | undefined;
    let reviews: AllegroReview[] = [];

    try {
      // Kattintás a "Termékvélemények" / "N értékelés és M vélemény" elemre
      const clicked = await page.evaluate(() => {
        for (const el of document.querySelectorAll('button, a, [role="button"]')) {
          const t = (el.textContent || '').trim();
          if (/Termékvélemények|értékelés és .* vélemény/.test(t)) {
            (el as HTMLElement).click();
            return t.slice(0, 80);
          }
        }
        return null;
      });
      if (clicked) {
        await sleep(5000);
        // Vélemények JSON kinyerése a modalból
        const reviewData = await page.evaluate(() => {
          const box = document.querySelector('[data-box-name="ProductReviews"], [data-box-name="ProductReviews.container"]');
          const src = box || document.body;
          const t = (src.textContent || '').trim();
          return t;
        });
        const m = reviewData.match(/([\d,.]+)\s*\/\s*5/);
        if (m) rating = parseFloat(m[1].replace(',', '.'));
        const c = reviewData.match(/([\d\s.]+)\s*értékelés és\s*([\d\s.]+)\s*vélemény/);
        if (c) ratingCount = parseInt(c[1].replace(/\s/g, ''), 10);

        // Vélemény blokkok kinyerése: dátum + szerző + szöveg minták alapján
        reviews = await page.evaluate(() => {
          const out: AllegroReviewLike[] = [];
          const containers = document.querySelectorAll('[data-box-name="ProductReviews"] [class*="review"], [data-box-name="ProductReviews"] article, [data-box-name="ProductReviews"] div');
          // Egyszerűbb megközelítés: dátum-minta szerint szegmentáljuk a modal szövegét
          const box = document.querySelector('[data-box-name="ProductReviews"]');
          if (!box) return out;
          const text = (box.textContent || '').replace(/\s+/g, ' ').trim();
          // "2026. február 27. tőle: C...9" minták
          const dateRe = /(\d{4}\.\s*(?:január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)\s*\d{1,2}\.)/g;
          const matches = [...text.matchAll(dateRe)];
          for (let i = 0; i < matches.length && out.length < 15; i++) {
            const start = matches[i].index! + matches[i][0].length;
            const end = i + 1 < matches.length ? matches[i + 1].index! : Math.min(start + 600, text.length);
            let chunk = text.slice(start, end);
            // Vágjuk le a "visszaélés bejelentése" jelzőt
            chunk = chunk.split('visszaélés bejelentése')[0].trim();
            // Szerző: "tőle: X..." után
            const authorM = chunk.match(/tőle:\s*(\S+)/);
            const author = authorM ? authorM[1] : undefined;
            // Meta-részek eltávolítása
            let textAfter = chunk
              .replace(/tőle:\s*\S+/g, '')
              .replace(/vásárlás tőle:\s*\S+/g, '')
              .replace(/Vélemény tartalma\s*/g, '')
              .replace(/Automatikusan lefordítva[^-]*- lásd az eredeti szöveget/g, '')
              .replace(/Automatikusan lefordítva/g, '')
              .replace(/További vélemények megtekintése\s*/g, '')
              .replace(/Előnyök\s*/g, '')
              .trim();
            if (textAfter.length > 10 && textAfter.length < 800) {
              out.push({ date: matches[i][0], author, text: textAfter.slice(0, 500) });
            }
          }
          return out;
        });
      }
    } catch {
      // vélemények opcionálisak
    }

    return {
      name: name || 'Ismeretlen termék',
      url,
      price: price || undefined,
      description,
      parameters,
      rating,
      ratingCount,
      reviews,
      images,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

type AllegroReviewLike = { date?: string; author?: string; text: string };