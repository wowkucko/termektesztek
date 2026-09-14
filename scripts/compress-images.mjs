// Egyeni keptomorites: public/uploads osszes kepe -> max 1280px + WebP q78,
// DB-hivatkozasok atirasa (content, cover, og) + PushFile terkep frissitese.
// Csak akkor cserel, ha az uj fajl kisebb. GIF-eket kihagyja.
// Futtatas: node scripts/compress-images.mjs [--dry-run]
import { PrismaClient } from "@prisma/client";
import { readdirSync, statSync, unlinkSync, existsSync } from "fs";
import { join, extname, basename } from "path";
import sharp from "sharp";
sharp.cache(false); // kulonben a bemeneti fajl nyitva marad es az unlink EPERM-mel elbukik

const DRY = process.argv.includes("--dry-run");
const DIR = "C:\\Users\\Tomi\\Desktop\\product-review-blog\\public\\uploads";
const p = new PrismaClient();

const files = readdirSync(DIR).filter((f) => {
  const e = extname(f).toLowerCase();
  return e && e !== ".gitkeep" && e !== ".gif" && statSync(join(DIR, f)).isFile();
});
console.log(`Kepek: ${files.length} db${DRY ? " (DRY-RUN)" : ""}`);

let totalBefore = 0, totalAfter = 0, converted = 0, skipped = 0;
const moves = []; // [regiUrl, ujUrl]

// 1. kor: fajlok tomoritese
for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const abs = join(DIR, f);
  const ext = extname(f).toLowerCase();
  try {
    const meta = await sharp(abs).metadata();
    const needsResize = (meta.width || 0) > 1280;
    if (ext === ".webp" && !needsResize) { skipped++; continue; }
    let pipe = sharp(abs).rotate();
    if (needsResize) pipe = pipe.resize({ width: 1280, withoutEnlargement: true });
    const outName = DRY ? `${basename(f, ext)}.dry.webp` : `${basename(f, ext)}.webp`;
    if (!DRY && outName === f && !needsResize) { skipped++; continue; }
    const outAbs = join(DIR, outName);
    await pipe.webp({ quality: 78 }).toFile(outAbs);
    const oldSize = statSync(abs).size;
    const newSize = statSync(outAbs).size;
    totalBefore += oldSize;
    if (newSize >= oldSize && !needsResize) {
      unlinkSync(outAbs);
      totalAfter += oldSize;
      skipped++;
      continue;
    }
    totalAfter += newSize;
    converted++;
    if (DRY) {
      unlinkSync(outAbs); // dry-run: a probafajlt eldobjuk
    } else if (outAbs !== abs) {
      // Előbb a DB-térkép, és csak utána a törlés: ha a törlés zárolás
      // miatt elbukik (EPERM), a DB akkor is a jó (új) URL-re mutat,
      // a régi fájl pedig legközelebb árvaként törölhető.
      moves.push([`/uploads/${f}`, `/uploads/${outName}`]);
      try {
        unlinkSync(abs);
      } catch (e) {
        console.log(`  TORLES HIBA (kesobb potolhato) ${f}: ${String(e).slice(0, 60)}`);
      }
    }
  } catch (e) {
    console.log(`  HIBA ${f}: ${String(e).slice(0, 80)}`);
  }
  if ((i + 1) % 300 === 0) console.log(`  ...${i + 1}/${files.length}`);
}
console.log(`\nKonvertalva: ${converted}, kihagyva: ${skipped}`);
console.log(`Meret: ${(totalBefore / 1048576).toFixed(1)} MB -> ${(totalAfter / 1048576).toFixed(1)} MB`);

// 2. kor: DB-atiras (csak tenyleges futaskor)
if (!DRY && moves.length > 0) {
  const posts = await p.post.findMany({ select: { id: true, content: true, coverImage: true, ogImage: true } });
  let touched = 0;
  for (const post of posts) {
    let { content, coverImage, ogImage } = post;
    let dirty = false;
    for (const [from, to] of moves) {
      if (content.includes(from)) { content = content.split(from).join(to); dirty = true; }
      if (coverImage === from) { coverImage = to; dirty = true; }
      if (ogImage === from) { ogImage = to; dirty = true; }
    }
    if (dirty) {
      await p.post.update({ where: { id: post.id }, data: { content, coverImage, ogImage } });
      touched++;
    }
  }
  console.log(`DB-ben frissitve: ${touched} cikk`);
  for (const [from, to] of moves) {
    await p.pushFile.updateMany({ where: { localPath: from }, data: { localPath: to } });
  }
  console.log("PushFile terkep frissitve");
}

// 3. kor: arva-riport (sehol nem hivatkozott fajlok)
const used = new Set();
const allPosts = await p.post.findMany({ select: { content: true, coverImage: true, ogImage: true } });
for (const post of allPosts) {
  for (const m of (post.content || "").matchAll(/(\/uploads\/[^\s)"']+)/g)) used.add(m[1].split(/[?#]/)[0]);
  if (post.coverImage) used.add(post.coverImage.split(/[?#]/)[0]);
  if (post.ogImage) used.add(post.ogImage.split(/[?#]/)[0]);
}
const pf = await p.pushFile.findMany({ select: { localPath: true } });
for (const r of pf) used.add(r.localPath);
const remaining = readdirSync(DIR).filter((f) => extname(f).toLowerCase() && statSync(join(DIR, f)).isFile());
let orphanBytes = 0;
const orphans = [];
for (const f of remaining) {
  if (f === ".gitkeep" || extname(f).toLowerCase() === ".gif") continue;
  if (!used.has(`/uploads/${f}`)) {
    orphanBytes += statSync(join(DIR, f)).size;
    orphans.push(f);
  }
}
console.log(`\nArva kepek: ${orphans.length} db, ${(orphanBytes / 1048576).toFixed(1)} MB`);
console.log("(torles kulon jovahagyassal)");
await p.$disconnect();
