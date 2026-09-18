// Összehasonlítás-audit: a valódi cikk-adatokon futtatja a hasonlósági motort,
// hogy látható legyen: hány cikk kap összehasonlító táblázatot, és mik a párosok.
// A pontszám-hisztogram a COMPARE_MIN_SCORE kalibrálásához kell.
//
// Futtatás: npm run compare:check
import { PrismaClient } from '@prisma/client';
import {
  findCompareMatches,
  similarityScore,
  COMPARE_MIN_SCORE,
  listComparePairs,
  vsSitemapPairs,
  VS_SITEMAP_MIN_SCORE,
  VS_SITEMAP_LIMIT,
} from '../src/lib/compare';
import { productClassesForPost } from '../src/lib/productClasses';
import type { RankablePost } from '../src/lib/data';

const prisma = new PrismaClient();

function label(p: { productName: string | null; productBrand: string | null }): string {
  return [p.productBrand, p.productName].filter(Boolean).join(' ') || '(név nélküli)';
}

async function main() {
  const rows = await prisma.post.findMany({
    where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    select: {
      id: true,
      slug: true,
      title: true,
      rating: true,
      priceFt: true,
      productName: true,
      productBrand: true,
      tags: { select: { tag: { select: { name: true } } } },
      category: { select: { name: true, slug: true } },
    },
    orderBy: { publishedAt: 'desc' },
  });
  const posts = rows as RankablePost[];

  // Pontszám-hisztogram (minden osztályos, pontozott, nem-kiegészítő pár).
  const histogram = new Map<number, number>();
  let compared = 0;
  let withTable = 0;
  const samples: string[] = [];

  const classesOf = new Map<string, number>();
  for (const p of posts) {
    classesOf.set(p.id, productClassesForPost(p, Number.MAX_SAFE_INTEGER).length);
  }

  // Kategória-megoszlás: hány cikk kap ott táblázatot, ahol a gadget-párok is élnek
  const byCategory = new Map<string, { total: number; with: number }>();

  for (const current of posts) {
    const matches = findCompareMatches(current, posts, 2);
    if (matches.length > 0) withTable += 1;

    const key = current.category?.name ?? '(nincs)';
    const entry = byCategory.get(key) ?? { total: 0, with: 0 };
    entry.total += 1;
    if (matches.length > 0) entry.with += 1;
    byCategory.set(key, entry);

    for (const m of matches) {
      compared += 1;
      histogram.set(m.score, (histogram.get(m.score) ?? 0) + 1);
    }
    // Néhány mintapár a magas pontszámokból
    for (const m of matches) {
      if (m.score >= 8 && samples.length < 12) {
        samples.push(
          `${current.title.slice(0, 46)}  ⇄  ${label(m.post)}  [${m.score}: ${m.reasons.join(', ')}]`
        );
      }
    }
  }

  console.log(`Cikkek: ${posts.length}`);
  console.log(`Cikk, ami kap összehasonlító táblázatot: ${withTable}`);
  console.log(`Generált párosok (max 2/cikk): ${compared}`);
  console.log('\nKategóriánként (táblázatot kapó / összes):');
  for (const [name, { total, with: w }] of [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${name.padEnd(22)} ${String(w).padStart(3)} / ${String(total).padStart(3)}`);
  }
  console.log(`\nPontszám-hisztogram (COMPARE_MIN_SCORE = ${COMPARE_MIN_SCORE}):`);
  for (const [score, count] of [...histogram.entries()].sort((a, b) => a[0] - b[0])) {
    const bar = '#'.repeat(Math.min(count, 60));
    console.log(`  ${String(score).padStart(2)}: ${String(count).padStart(4)}  ${bar}`);
  }

  if (samples.length > 0) {
    console.log('\nLegjobbak mintái:');
    for (const s of samples) console.log(`  - ${s}`);
  }

  // --- Vs-oldalak (/osszehasonlitas/a-vs-b) kalibráció ---
  const allPairs = listComparePairs(posts);
  const sitemapPairs = vsSitemapPairs(allPairs);
  console.log(
    `\nVs-oldalak: ${allPairs.length} élő páros összesen, ebből ${allPairs.filter((p) => p.score >= VS_SITEMAP_MIN_SCORE).length} indexelhető (küszöb ${VS_SITEMAP_MIN_SCORE}), sitemapbe: ${sitemapPairs.length} (limit ${VS_SITEMAP_LIMIT})`
  );
  console.log('Top 10 indexelt páros:');
  for (const p of sitemapPairs.slice(0, 10)) {
    console.log(`  - ${label(p.a)}  vs  ${label(p.b)}  [${p.score}]`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
