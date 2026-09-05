// Push-script: itthon legenerált cikkek feltöltése egy TÁVOLI (éles) blogra.
// Használat:
//   node scripts/push-posts.mjs --to=https://domain.hu --email=admin@... --password=...
//   node scripts/push-posts.mjs --to=https://domain.hu --slug=cikk-slug      (1 cikk)
//   node scripts/push-posts.mjs --to=https://domain.hu --dry-run              (próba)
// Env alternatíva: PUSH_TO, PUSH_EMAIL, PUSH_PASSWORD.
// Működés: login (session cookie) -> kategóriák szinkronja slug alapján ->
// képek feltöltése (/uploads/* átírása távoli URL-ekre) -> cikk POST.
// Állapot: scripts/pushed.json (melyik cikk ment már fel, kép-URL térkép).
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = path.join(ROOT, "scripts", "pushed.json");

const rawArgs = process.argv.slice(2);
const args = {};
for (let i = 0; i < rawArgs.length; i++) {
  const m = rawArgs[i].match(/^--([^=]+)(=(.*))?$/);
  if (!m) continue;
  if (m[3] !== undefined) {
    args[m[1]] = m[3]; // --kulcs=ertek
  } else if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith("--")) {
    args[m[1]] = rawArgs[i + 1]; // --kulcs ertek
    i++;
  } else {
    args[m[1]] = true; // --flag
  }
}
const TO = (args.to || process.env.PUSH_TO || "").toString().replace(/\/$/, "");
const EMAIL = (args.email || process.env.PUSH_EMAIL || "").toString();
const PASSWORD = (args.password || process.env.PUSH_PASSWORD || "").toString();
const DRY = Boolean(args["dry-run"]);
const ONLY_SLUG = args.slug ? String(args.slug) : null;
const LIMIT = args.limit ? parseInt(String(args.limit), 10) : null;
const FORCE = Boolean(args.force);

if (!TO) {
  console.error("Hiba: --to=https://tavoli-domain.hu megadasa kotelezo.");
  process.exit(1);
}
if (!DRY && (!EMAIL || !PASSWORD)) {
  console.error("Hiba: --email/--password (vagy PUSH_EMAIL/PUSH_PASSWORD) kotelezo.");
  process.exit(1);
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { posts: {}, files: {} };
  }
}
function saveState(s) {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 1));
}

// Egyszerű cookie-jar a session-höz
let jar = "";
async function api(pathname, { method = "GET", json, form } = {}) {
  const headers = {};
  if (jar) headers.cookie = jar;
  let body;
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form; // fetch allitja be a boundary-t
  }
  const res = await fetch(TO + pathname, { method, headers, body });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    // csak a session sütit tartjuk meg
    const m = setCookie.match(/session=[^;]+/);
    if (m) jar = m[0];
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* nem JSON */
  }
  return { status: res.status, data, text };
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

function localFilesIn(content, ...extra) {
  const found = new Set();
  const re = /\((\/uploads\/[^)\s"']+)\)/g;
  let m;
  const all = [content, ...extra.filter(Boolean)];
  for (const t of all) {
    if (typeof t !== "string") continue;
    while ((m = re.exec(t))) found.add(m[1]);
  }
  // cover/og, ha helyi útvonal
  for (const u of extra) {
    if (typeof u === "string" && u.startsWith("/") && !u.startsWith("//")) found.add(u.split(/[?#]/)[0]);
  }
  return [...found];
}

const prisma = new PrismaClient();
const state = loadState();

console.log(`Cel: ${TO}${DRY ? " (DRY-RUN, nincs feltoltes)" : ""}`);

// 1. login
if (!DRY) {
  const r = await api("/api/admin/auth/login", { method: "POST", json: { email: EMAIL, password: PASSWORD } });
  if (r.status !== 200) {
    console.error(`Login sikertelen (${r.status}): ${r.text.slice(0, 200)}`);
    process.exit(1);
  }
  console.log("Login OK.");
}

// 2. pusholandó cikkek
let posts = await prisma.post.findMany({
  where: { status: "PUBLISHED", ...(ONLY_SLUG ? { slug: ONLY_SLUG } : {}) },
  include: { category: true, tags: { include: { tag: true } } },
  orderBy: { publishedAt: "asc" },
});
if (!FORCE) posts = posts.filter((p) => !state.posts[p.slug]);
if (LIMIT) posts = posts.slice(0, LIMIT);
if (posts.length === 0) {
  console.log(ONLY_SLUG && state.posts[ONLY_SLUG] ? "Ez a cikk már fel van töltve (--force-szal újra lehet)." : "Nincs új feltöltendő cikk.");
  await prisma.$disconnect();
  process.exit(0);
}
console.log(`Feltöltendő cikk: ${posts.length} db`);

// 3. kategóriák biztosítása a távoli oldalon (slug alapján)
const cats = new Map();
for (const p of posts) cats.set(p.category.slug, p.category);
for (const c of cats.values()) {
  if (DRY) {
    console.log(`  [dry] kategoria: ${c.slug}`);
    continue;
  }
  const r = await api("/api/admin/categories", {
    method: "POST",
    json: { name: c.name, slug: c.slug, description: c.description },
  });
  if (r.status === 201) console.log(`  kategoria letrehozva: ${c.slug}`);
  else if (r.status === 400) console.log(`  kategoria mar letezik: ${c.slug}`);
  else {
    console.error(`  kategoria HIBA ${c.slug}: ${r.status} ${String(r.text).slice(0, 150)}`);
    process.exit(1);
  }
}

// 4-5. cikkenként: képek + POST
const safeParse = (v) => {
  try {
    const a = JSON.parse(v || "[]");
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
let done = 0;
for (const p of posts) {
  const files = localFilesIn(p.content, p.coverImage, p.ogImage);
  const urlMap = {};
  for (const local of files) {
    if (state.files[local]) {
      urlMap[local] = state.files[local];
      continue;
    }
    if (DRY) {
      urlMap[local] = `<tavoli>${local}`;
      continue;
    }
    const abs = path.join(ROOT, "public", local);
    if (!existsSync(abs)) {
      console.error(`  [${p.slug}] HIANYZO KEP: ${local} - cikk kihagyva.`);
      urlMap[local] = null;
      break;
    }
    const ext = path.extname(local).toLowerCase();
    const buf = await readFile(abs);
    const form = new FormData();
    form.append("file", new Blob([buf], { type: MIME[ext] || "image/jpeg" }), path.basename(local));
    const up = await api("/api/admin/upload", { method: "POST", form });
    if (up.status !== 200 || !up.data?.url) {
      console.error(`  [${p.slug}] KEPFELTOLTES HIBA ${local}: ${up.status} ${String(up.text).slice(0, 150)}`);
      urlMap[local] = null;
      break;
    }
    urlMap[local] = up.data.url;
    state.files[local] = up.data.url;
  }
  if (Object.values(urlMap).some((v) => v === null)) continue; // hibás kép miatt kihagyva

  const rewrite = (t) => {
    if (typeof t !== "string") return t;
    let out = t;
    for (const [from, to] of Object.entries(urlMap)) out = out.split(from).join(to);
    return out;
  };
  const payload = {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    content: rewrite(p.content),
    coverImage: rewrite(p.coverImage),
    coverImageAlt: p.coverImageAlt,
    categorySlug: p.category.slug,
    tags: p.tags.map((t) => t.tag.name),
    status: "PUBLISHED",
    productName: p.productName,
    productBrand: p.productBrand,
    priceFt: p.priceFt,
    rating: p.rating,
    pros: safeParse(p.pros),
    cons: safeParse(p.cons),
    verdict: p.verdict,
    affiliateUrl: p.affiliateUrl,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    ogImage: rewrite(p.ogImage),
  };
  if (DRY) {
    console.log(`  [dry] ${p.slug} (${files.length} kep)`);
    continue;
  }
  const r = await api("/api/admin/posts", { method: "POST", json: payload });
  if (r.status !== 201 || !r.data?.ok) {
    console.error(`  [${p.slug}] CIKK HIBA: ${r.status} ${String(r.text).slice(0, 200)}`);
    saveState(state);
    continue;
  }
  state.posts[p.slug] = { remoteSlug: r.data.slug, pushedAt: new Date().toISOString() };
  saveState(state);
  done++;
  console.log(`  OK: ${p.slug} -> ${TO}/blog/${r.data.slug}`);
}

console.log(DRY ? "Dry-run kesz." : `Kesz: ${done}/${posts.length} cikk feltoltve.`);
await prisma.$disconnect();
