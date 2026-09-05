// Mobil audit Playwright-tel: tobb viewport, tobb oldal.
// Meresek: konzol-hibak, page-errorok, vizszintes overflow, screenshotok,
// mobil menu, kereso, tap-target meretek.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const SLUGS = JSON.parse(process.env.SLUGS || "{}");
const OUT = "C:/Users/Tomi/Desktop/product-review-blog/test-results/mobile";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "small-360", width: 360, height: 740, mobile: true },
  { name: "iphone-390", width: 390, height: 844, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: true },
];

const brandSlug = (SLUGS.brand || "asus").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const PAGES = [
  { name: "home", path: "/" },
  { name: "blog", path: `/blog/${SLUGS.post}` },
  { name: "kategoria", path: `/kategoria/${SLUGS.cat}` },
  { name: "toplista", path: `/legjobb/${SLUGS.cat}` },
  { name: "marka", path: `/marka/${brandSlug}` },
  { name: "kereses", path: "/kereses?q=fejhallgat%C3%B3" },
  { name: "karacsony", path: "/karacsony" },
];

const browser = await chromium.launch();
const report = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));

  for (const pg of PAGES) {
    const url = BASE + pg.path;
    const entry = { viewport: vp.name, page: pg.name, url, status: 0, overflow: false, offenders: [], consoleErrors: [], pageErrors: [], note: "" };
    try {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      entry.status = res?.status() || 0;
      await page.waitForTimeout(1200);
      // vegiggorggetes (lazy kepek miatt), majd vissza a tetejere
      await page.evaluate(async () => {
        await new Promise((r) => {
          let y = 0;
          const t = setInterval(() => { y += 600; window.scrollTo(0, y); if (y > document.body.scrollHeight) { clearInterval(t); r(0); } }, 60);
        });
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(600);
      const ov = await page.evaluate(() => {
        const bad = [];
        const vw = window.innerWidth;
        document.querySelectorAll("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.left < -1 || r.right > vw + 1)) {
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === "string" ? el.className : "").split(" ").slice(0, 3).join(".");
            bad.push(`${tag}.${cls} [${Math.round(r.left)},${Math.round(r.right)}]`);
          }
        });
        return { scrollW: document.documentElement.scrollWidth, vw, bad: [...new Set(bad)].slice(0, 8) };
      });
      entry.overflow = ov.scrollW > ov.vw + 1;
      entry.offenders = ov.bad;
      entry.consoleErrors = [...new Set(consoleErrors)].slice(0, 5);
      entry.pageErrors = [...new Set(pageErrors)].slice(0, 5);
      consoleErrors.length = 0; pageErrors.length = 0;
      await page.screenshot({ path: `${OUT}/${vp.name}-${pg.name}.png` });
      // hosszu oldalaknal full-page is a blogrol (kicsiben)
      if (pg.name === "blog" && vp.name === "iphone-390") {
        await page.screenshot({ path: `${OUT}/${vp.name}-${pg.name}-full.png`, fullPage: true });
      }
    } catch (e) {
      entry.note = "NAV HIBA: " + String(e).slice(0, 120);
    }
    report.push(entry);
    console.log(`${vp.name} ${pg.name}: status=${entry.status} overflow=${entry.overflow} cerr=${entry.consoleErrors.length} perr=${entry.pageErrors.length} ${entry.note}`);
  }

  // --- interakciok (iphone-390-en): menu -> kereses -> kategoria-tap ---
  if (vp.name === "iphone-390") {
    const inter = { viewport: vp.name, page: "interakciok", checks: {} };
    try {
      await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 45000 });
      await page.locator("header button").first().click();
      await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
      inter.checks.menuOpened = true;
      await page.screenshot({ path: `${OUT}/${vp.name}-menu-nyitva.png` });
      await page.locator('[role="dialog"] input').first().fill("sony");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${vp.name}-kereso-talalatok.png` });
      inter.checks.searchWorks = true;
      // kategoria-tap (touch): valos mobil-erinkezes szimulacio
      await page.locator('[role="dialog"] a[href^="/kategoria/"]').first().tap({ timeout: 10000 });
      await page.waitForTimeout(2000);
      inter.checks.categoryTapUrl = page.url();
      // tap-target: vasarlas gomb merete a blogon
      await page.goto(BASE + `/blog/${SLUGS.post}`, { waitUntil: "networkidle", timeout: 45000 });
      const buy = page.locator('a:has-text("Termék megvásárlása")').first();
      if (await buy.count() > 0) {
        const box = await buy.boundingBox();
        inter.checks.buyButton = box ? { w: Math.round(box.width), h: Math.round(box.height) } : null;
      }
      // komment urlap letezik-e
      inter.checks.commentForm = (await page.locator('form:has-text("Hozzászólás")').count()) > 0;
    } catch (e) {
      inter.checks.error = String(e).slice(0, 150);
    }
    report.push(inter);
    console.log("INTERAKCIOK: " + JSON.stringify(inter.checks));
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log("KESZ: " + OUT);
