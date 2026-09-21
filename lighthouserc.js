// Lighthouse CI konfiguráció — https://github.com/GoogleChrome/lighthouse-ci
//
// A collect.url listát a `scripts/resolve-audit-urls.ts` tölti fel a
// .lhci-urls.json fájlba (főoldal + legfrissebb cikk + a legtöbb cikket
// tartalmazó kategória és címke), így az URL-ek a mindenkori tartalomhoz
// igazodnak. Ha a fájl hiányzik (pl. közvetlen `lhci autorun`), a főoldalra esik
// vissza.
//
// A resolver a crawl-budget szabály alatti (kevés cikkes) listaoldalakat és a
// küszöb alatti (élő, de noindex) vs-párosokat külön listázza `noindexExpected`
// néven: azokon a noindex helyes viselkedés, ezért rájuk enyhébb SEO-küszöb
// vonatkozik (lásd lent).

const fs = require('node:fs');

let urls = ['http://localhost:4321/'];
let noindexExpected = [];
try {
  const raw = JSON.parse(fs.readFileSync('.lhci-urls.json', 'utf8'));
  // Régebbi formátum (sima URL-tömb) is elfogadott.
  if (Array.isArray(raw)) {
    urls = raw.length ? raw : urls;
  } else {
    urls = raw.urls?.length ? raw.urls : urls;
    noindexExpected = raw.noindexExpected ?? [];
  }
} catch {
  // marad a főoldal
}

// Valódi (devtools) throttling: a Chrome ténylegesen 4x CPU-lassítással és
// mobil hálózati korlátozással tölti be az oldalt, és a mért értékek a valós
// időzítések. A LH alapértelmezett „simulate" módja egy modellre épül, ami
// ezen az oldalon ~4s LCP-t jósolt, miközben a valódi throttled mérés ~2s
// (a böngésző maga mondja meg, mit tud) — a devtools mód ezért pontosabb és
// stabilabb itt. Megjegyzés: a számok gépfüggőek (a valódi throttling a gép
// teljesítményétől is függ), ezért a küszöb 0.85-ön áll hagymával.
const settings = { throttlingMethod: 'devtools' };
// CI-konténerekben (GitHub Actions) a Chrome sandbox nem engedélyezett.
if (process.env.LHCI_NO_SANDBOX) {
  settings.chromeFlags = '--no-sandbox --disable-dev-shm-usage';
}

// Küszöbértékek — ha romlik a teljesítmény vagy a SEO, piros a CI.
// Hangolás: a lighthouserc.js ezen szakasza; a mért értékeket a
// .lighthouseci/ jelentéseiből olvashatod ki.
// Referencia mérés (mobil, devtools-throttled): perf 0.85–0.99, a11y 0.94+,
// best-practices 1.0, seo 1.0 — a küszöb 0.8, hogy a gép-zaj is beleférjen.
// Megjegyzés: a cikkoldal azóta saját kliens JS nélküli (RSC), ezért a
// böngésző ~0.6s-mal korábban fest (FCP 1.5s vs 2.1s), és a LH a festés
// utáni hosszú feladatokat TBT-ként számolja — a teljes main-thread munka
// változatlan (1.4s), csak átcsúszott a festés utánra.
const SEO_MIN_SCORE = 0.95;
// A szándékosan noindex oldalakon a Lighthouse `is-crawlable` auditja
// jogosan bukik: a noindex itt nem hiba, hanem a crawl-budget szabály
// (MIN_POSTS_FOR_LISTING_INDEX a listaoldalakon, VS_SITEMAP_MIN_SCORE a
// küszöb alatti vs-párosokon — lásd src/lib/seo.ts és src/lib/compare.ts)
// szándékos következménye.
// Ezekre ezért csak az is-crawlable hiányát engedjük meg: a SEO-pontszám így
// 0.664, mert az is-crawlable súlya ~4.04 a ~12.04 összsúlyból. A 0.6-os küszöb
// szándékosan szűk — bármely további audit elbukása (hiányzó cím/leírás,
// canonical, státuszkód, robotok) 0.58 alá viszi a pontszámot, tehát pirosat
// jelent. Minden más oldalra a szigorú 0.95 marad: a főoldal, cikk, toplisták,
// a vs-hub és az indexelt vs-páros is ide tartozik.
const SEO_MIN_SCORE_NOINDEX_EXPECTED = 0.6;

const thresholds = (seoMinScore) => ({
  'categories:performance': ['error', { minScore: 0.8 }],
  'categories:accessibility': ['error', { minScore: 0.9 }],
  'categories:best-practices': ['error', { minScore: 0.9 }],
  'categories:seo': ['error', { minScore: seoMinScore }],
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const urlPattern = (list) => list.map(escapeRegex).join('|');

// URL-enként eltérő küszöböt csak az assertMatrix ad: a sima `assertions` érték
// egyetlen [szint, beállítások] pár — listát adva a Lighthouse CI csendben a
// saját alapértelmezett 0.9-ére esik vissza, és a szándékos kivétel elveszik.
//
// A két minta szándékosan fedi le az összes URL-t: a noindexes oldalakat pontosan
// felsorolva (horgonyozva, különben a főoldal `http://host/` előtagként minden
// másikra is illeszkedne), a többit pedig negatív lookahead-del, hogy egy
// véletlenül kimaradó URL se ússzon meg ellenőrzés nélkül. A noindex-bucketbe a
// resolver veszi fel a thin listaoldalakat ÉS a küszöb alatti vs-párosokat —
// a vs-hub és az indexelt vs-páros a szigorú bucketbe esik.
let assertOptions = { assertions: thresholds(SEO_MIN_SCORE) };
if (noindexExpected.length > 0) {
  const thinPattern = urlPattern(noindexExpected);
  assertOptions = {
    assertMatrix: [
      {
        matchingUrlPattern: `^(?:${thinPattern})/?$`,
        assertions: thresholds(SEO_MIN_SCORE_NOINDEX_EXPECTED),
      },
      {
        matchingUrlPattern: `^(?!.*(?:${thinPattern}))`,
        assertions: thresholds(SEO_MIN_SCORE),
      },
    ],
  };
}

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: Number(process.env.LHCI_RUNS || '1'),
      startServerCommand: 'next start -p 4321',
      settings,
    },
    assert: assertOptions,
    upload: {
      // Helyi fájlrendszerre ment (HTML + JSON jelentések), nem küld sehová.
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
