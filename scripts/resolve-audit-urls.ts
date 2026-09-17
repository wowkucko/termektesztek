// Feloldja az auditálandó főbb oldalak URL-jeit az adatbázisból, és elmenti
// őket a .lhci-urls.json fájlba, amit a lighthouserc.js olvas be.
//
// Az URL-készlet a mindenkori tartalomhoz igazodik: főoldal + legfrissebb
// publikált cikk + a legtöbb cikket tartalmazó kategória + a legtöbb cikket
// tartalmazó címke. Ha valamelyik hiányzik (pl. üres DB), az egyszerűen kimarad
// — a főoldal mindig szerepel.
//
// A listaoldalaknál a cikkszám számít: a crawl-budget szabály
// (MIN_POSTS_FOR_LISTING_INDEX, lásd src/lib/seo.ts) alatti listák szándékosan
// noindexek, ezért azokat külön jelöljük (`noindexExpected`), hogy a Lighthouse
// ne a SEO-pontszámon bukjon meg rajtuk: a noindex ott helyes viselkedés.
//
// Futtatás: npm run lighthouse:ci  (vagy: npx tsx scripts/resolve-audit-urls.ts)

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MIN_POSTS_FOR_LISTING_INDEX } from '../src/lib/seo';

const BASE_URL = process.env.LHCI_BASE_URL || 'http://localhost:4321';

async function main() {
  const prisma = new PrismaClient();
  const publishedWhere = { status: 'PUBLISHED', publishedAt: { lte: new Date() } };

  const urls: string[] = [BASE_URL + '/'];
  // Ezeket az oldalakat a crawl-budget szabály miatt szándékosan nem indexeljük
  // (kevés a cikk), így a rajtuk mért is-crawlable hibát a lighthouserc.js
  // enyhébben pontozza.
  const noindexExpected: string[] = [];

  try {
    const post = await prisma.post.findFirst({
      where: publishedWhere,
      orderBy: { publishedAt: 'desc' },
      select: { slug: true },
    });
    if (post) urls.push(`${BASE_URL}/blog/${post.slug}`);
  } catch {
    // DB hiba esetén csak a főoldal megy az auditba
  }

  // A legtöbb cikket tartalmazó kategóriát mérjük: az a legreprezentatívabb, és a
  // crawl-budget küszöb fölött pont az ilyen listaoldalak indexelhetők.
  try {
    const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
    let best: { slug: string; count: number } | null = null;
    for (const category of categories) {
      const count = await prisma.post.count({
        where: { ...publishedWhere, categoryId: category.id },
      });
      if (!best || count > best.count) best = { slug: category.slug, count };
    }
    if (best) {
      const url = `${BASE_URL}/kategoria/${best.slug}`;
      urls.push(url);
      if (best.count < MIN_POSTS_FOR_LISTING_INDEX) {
        noindexExpected.push(url);
        console.log(
          `  (${best.slug}: csak ${best.count} cikk → szándékosan noindex, enyhébb SEO-küszöb)`
        );
      }
    }
  } catch {}

  try {
    const tags = await prisma.tag.findMany({ select: { id: true, slug: true } });
    let best: { slug: string; count: number } | null = null;
    for (const tag of tags) {
      const count = await prisma.post.count({
        where: { ...publishedWhere, tags: { some: { tagId: tag.id } } },
      });
      if (!best || count > best.count) best = { slug: tag.slug, count };
    }
    if (best) {
      const url = `${BASE_URL}/cimke/${best.slug}`;
      urls.push(url);
      if (best.count < MIN_POSTS_FOR_LISTING_INDEX) {
        noindexExpected.push(url);
        console.log(
          `  (${best.slug}: csak ${best.count} cikk → szándékosan noindex, enyhébb SEO-küszöb)`
        );
      }
    }
  } catch {}

  await prisma.$disconnect();

  writeFileSync(resolve('.lhci-urls.json'), JSON.stringify({ urls, noindexExpected }, null, 2));
  console.log(`Audit URL-ek (${urls.length}, ebből ${noindexExpected.length} szándékosan noindex):`);
  for (const url of urls) {
    console.log(`  ${url}${noindexExpected.includes(url) ? '  [noindex]' : ''}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
