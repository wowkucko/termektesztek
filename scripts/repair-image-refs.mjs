// Helyreallito: a NEM letezo fajlokra mutato cikk-hivatkozasok atirasa a
// meglevo .webp ikertestverre (azonos basename). Ilyen allapot akkor maradhat,
// ha a tomorites es egy push-frissites sorrendje osszecsuszott.
// Futtatas: node --env-file=.env scripts/repair-image-refs.mjs [--dry-run]
import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import { join, extname, basename, dirname, sep } from "path";
import { fileURLToPath } from "url";

const DRY = process.argv.includes("--dry-run");
const PUB = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const p = new PrismaClient();
const local = (u) => join(PUB, ...u.split("/").filter(Boolean));

const posts = await p.post.findMany({ select: { id: true, slug: true, content: true, coverImage: true, ogImage: true } });
let fixedPosts = 0, fixedRefs = 0;
const noTwin = [];
for (const post of posts) {
  const refs = new Set();
  for (const m of (post.content || "").matchAll(/(\/uploads\/[^\s)"']+)/g)) refs.add(m[1].split(/[?#]/)[0]);
  if (post.coverImage?.startsWith("/uploads/")) refs.add(post.coverImage);
  if (post.ogImage?.startsWith("/uploads/")) refs.add(post.ogImage);
  const mapping = new Map();
  for (const u of refs) {
    if (existsSync(local(u))) continue;
    const twin = `/uploads/${basename(u, extname(u))}.webp`;
    if (twin !== u && existsSync(local(twin))) {
      mapping.set(u, twin);
    } else {
      noTwin.push(`${post.slug}: ${u}`);
    }
  }
  if (mapping.size === 0) continue;
  let { content, coverImage, ogImage } = post;
  for (const [from, to] of mapping) {
    content = (content || "").split(from).join(to);
    if (coverImage === from) coverImage = to;
    if (ogImage === from) ogImage = to;
  }
  if (!DRY) await p.post.update({ where: { id: post.id }, data: { content, coverImage, ogImage } });
  fixedPosts++;
  fixedRefs += mapping.size;
}
console.log(`${DRY ? "[DRY] " : ""}Javitott cikk: ${fixedPosts}, atirt hivatkozas: ${fixedRefs}`);
if (noTwin.length > 0) {
  console.log(`Ikertestver nelkuli hianyzo fajlok (${noTwin.length}):`);
  for (const s of noTwin.slice(0, 20)) console.log("  " + s);
}
await p.$disconnect();
