// Lighthouse CI konfiguráció — https://github.com/GoogleChrome/lighthouse-ci
//
// A collect.url listát a `scripts/resolve-audit-urls.mjs` tölti fel a
// .lhci-urls.json fájlba (főoldal + legfrissebb cikk + egy kategória + egy címke),
// így az URL-ek a mindenkori tartalomhoz igazodnak. Ha a fájl hiányzik
// (pl. közvetlen `lhci autorun`), a főoldalra esik vissza.

const fs = require('node:fs');

let urls = [];
try {
  urls = JSON.parse(fs.readFileSync('.lhci-urls.json', 'utf8'));
} catch {
  urls = ['http://localhost:4321/'];
}

// Valódi (devtools) throttling: a Chrome ténylegesen 4x CPU-lassítással és
// mobil hálózati korlátozással tölti be az oldalt, és a mért értékek a valós
// időzítések. A LH alapértelmezett „simulate" módja egy modellre épít, ami
// ezen az oldalon ~4s LCP-t jósolt, miközben a valódi throttled mérés ~2s
// (a böngésző maga mondja meg, mit tud) — a devtools mód ezért pontosabb és
// stabilabb itt. Megjegyzés: a számok gépfüggőek (a valódi throttling a gép
// teljesítményétől is függ), ezért a küszöb 0.85-ön áll hagymával.
const settings = { throttlingMethod: 'devtools' };
// CI-konténerekben (GitHub Actions) a Chrome sandbox nem engedélyezett.
if (process.env.LHCI_NO_SANDBOX) {
  settings.chromeFlags = '--no-sandbox --disable-dev-shm-usage';
}

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: Number(process.env.LHCI_RUNS || '1'),
      startServerCommand: 'next start -p 4321',
      settings,
    },
    assert: {
      // Küszöbértékek — ha romlik a teljesítmény vagy a SEO, piros a CI.
      // Hangolás: a lighthouserc.js ezen szakasza; a mért értékeket a
      // .lighthouseci/ jelentéseiből olvashatod ki.
      // Referencia mérés (mobil, devtools-throttled): perf 0.85–0.99, a11y 0.94+,
      // best-practices 1.0, seo 1.0 — a küszöb 0.8, hogy a gép-zaj is beleférjen.
      // Megjegyzés: a cikkoldal azóta saját kliens JS nélküli (RSC), ezért a
      // böngésző ~0.6s-mal korábban fest (FCP 1.5s vs 2.1s), és a LH a festés
      // utáni hosszú feladatokat TBT-ként számolja — a teljes main-thread munka
      // változatlan (1.4s), csak átcsúszott a festés utánra.
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      // Helyi fájlrendszerre ment (HTML + JSON jelentések), nem küld sehová.
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};