import { execSync } from "child_process";
const CHROME = "C:\\Users\\Tomi\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe";
const urls = [
  "http://localhost:3000/",
  "http://localhost:3000/blog/steelseries-arctis-nova-7x-gen-2-teszt-az-univerzalis-gamer-fejhallgato-amire-a-konzolosok-vagytak",
  "http://localhost:3000/kategoria/okostelefonok",
  "http://localhost:3000/cimke/ar-ertek-arany",
];
for (const u of urls) {
  const tag = u.replace("http://localhost:3000", "LOCAL").replace(/\//g, "_") || "home";
  console.log(`\n===== ${u} =====`);
  try {
    const out = execSync(
      `npx lighthouse "${u}" --only-categories=accessibility --preset=desktop --output=json --output-path=stdout --chrome-flags="--no-sandbox --headless=new" --quiet --max-wait-for-load 30000`,
      { encoding: "utf8", timeout: 180000, env: { ...process.env, CHROME_PATH: CHROME }, cwd: "C:\\Users\\Tomi\\Desktop\\product-review-blog" }
    );
    const j = JSON.parse(out.slice(out.indexOf("{")));
    const score = j.categories.accessibility.score;
    console.log(`SCORE: ${score}`);
    for (const [id, a] of Object.entries(j.audits)) {
      if (a.scoreDisplayMode === "manual" || a.scoreDisplayMode === "notApplicable" || a.scoreDisplayMode === "informative") continue;
      if (a.score !== null && a.score < 1) {
        const details = (a.details?.items || []).slice(0, 4).map((it) => it.node?.snippet || it.node?.selector || JSON.stringify(it).slice(0, 100));
        console.log(`- FAIL ${id} (${a.score}): ${a.title}`);
        details.forEach((d) => console.log(`    ${d}`));
      }
    }
  } catch (e) {
    console.log("LH HIBA: " + String(e.message).slice(0, 200));
  }
}
