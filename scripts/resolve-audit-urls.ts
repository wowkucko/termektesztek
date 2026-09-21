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
import { listComparePairs, vsSitemapPairs, VS_SITEMAP_MIN_SCORE } from '../src/lib/compare';

// A data.ts-beli segéd lokális mása: a data.ts-et szándékosan NEM importáljuk
// (a React cache()-je sima Node-ban nem hívható — lásd a check-compare.ts konvencióját).
function safeParseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

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

  // Vs-oldalak (/osszehasonlitas): a hub csak akkor megy az auditba, ha van
  // indexelt páros mögötte (üres hub vékony oldal lenne). Párosból a legmagasabb
  // pontszámú indexelt (sitemap-küszöb feletti) párost mérjük szigorú küszöbbel,
  // és egy küszöb alatti, de élő (noindex, follow) párost is — arra az
  // is-crawlable jogosan bukik, ezért enyhébb bucketbe kerül, mint a noindex
  // listaoldalak (0.6): a küszöb alatti párosnak csak a crawlability hiánya megengedett.
  try {
    const rows = await prisma.post.findMany({
      where: publishedWhere,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        coverImageAlt: true,
        rating: true,
        priceFt: true,
        productName: true,
        productBrand: true,
        affiliateUrl: true,
        publishedAt: true,
        category: { select: { name: true, slug: true } },
        pros: true,
        cons: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
      orderBy: { publishedAt: 'desc' },
    });
    const rankable = rows.map((row) => ({
      ...row,
      pros: safeParseStringArray(row.pros),
      cons: safeParseStringArray(row.cons),
    }));
    const allComparePairs = listComparePairs(rankable);
    const sitemapPairUrls = vsSitemapPairs(allComparePairs).map(
      (p) => `${BASE_URL}/osszehasonlitas/${p.slug}`
    );
    if (sitemapPairUrls.length > 0) {
      const hubUrl = `${BASE_URL}/osszehasonlitas`;
      urls.push(hubUrl, sitemapPairUrls[0]);
      console.log(`  (vs-hub: ${sitemapPairUrls.length} indexelt páros, a legjobbat mérjük)`);
      // Egy élő, de noindex páros is az auditba — csak ha van a küszöb alattító (különben
      // ugyanazt az oldalt kétszer mérnénk).
      const noindexCandidates = allComparePairs.filter(
        (p) => p.score < VS_SITEMAP_MIN_SCORE
      );
      if (noindexCandidates.length > 0) {
        const noindexUrl = `${BASE_URL}/osszehasonlitas/${noindexCandidates[0].slug}`;
        if (!urls.includes(noindexUrl)) {
          urls.push(noindexUrl);
          noindexExpected.push(noindexUrl);
          console.log(`  (noindex vs-páros: ${noindexCandidates[0].slug} [pontszám ${noindexCandidates[0].score}])`);
        }
      }
    }
  } catch {
    // compare lib / DB hiba esetén a többi URL megy az auditba
  }

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
