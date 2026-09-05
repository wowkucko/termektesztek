// Feloldja az auditálandó főbb oldalak URL-jeit az adatbázisból, és elmenti
// őket a .lhci-urls.json fájlba, amit a lighthouserc.js olvas be.
//
// Az URL-készlet a mindenkori tartalomhoz igazodik: főoldal + legfrissebb
// publikált cikk + az első kategória + az első címke. Ha valamelyik hiányzik
// (pl. üres DB), az egyszerűen kimarad — a főoldal mindig szerepel.

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env.LHCI_BASE_URL || 'http://localhost:4321';
const prisma = new PrismaClient();

const paths = ['/'];

try {
  const post = await prisma.post.findFirst({
    where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    select: { slug: true },
  });
  if (post) paths.push(`/blog/${post.slug}`);
} catch {
  // DB hiba esetén csak a főoldal megy az auditba
}

try {
  const category = await prisma.category.findFirst({ select: { slug: true } });
  if (category) paths.push(`/kategoria/${category.slug}`);
} catch {}

try {
  const tag = await prisma.tag.findFirst({ select: { slug: true } });
  if (tag) paths.push(`/cimke/${tag.slug}`);
} catch {}

await prisma.$disconnect();

const urls = paths.map((p) => BASE_URL + p);
writeFileSync(resolve('.lhci-urls.json'), JSON.stringify(urls, null, 2));
console.log(`Audit URL-ek (${urls.length}):`);
for (const u of urls) console.log(`  ${u}`);