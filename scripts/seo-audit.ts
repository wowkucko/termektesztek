// SEO audit: a fő oldaltípusok renderelt HTML-jét nézi végig, és hibát jelez,
// ha egy oldalról lemaradt az og:image, a canonical vagy az elvárt JSON-LD.
//
// Motiváció: a Next.js metadata shallow merge-je miatt már bukott el egyszer a
// megosztási kép (a saját openGraph-ot definiáló oldalakról leesett az og:image,
// lásd README "OG/Twitter kép minden oldalon"). Ez a script ezt az osztály
// hibát szúrja ki automatikusan, build/deploy után.
//
// Az auditált URL-készlet a mindenkori tartalomhoz igazodik: főoldal,
// legfrissebb (nem 18+) cikk, a legtöbb cikkel rendelkező kategória/címke/márka,
// a legnagyobb termékosztály-toplista és a szezonális hubok. Az URL-feloldás ugyan-
// azokat a küszöböket használja, mint az oldalak (MIN_POSTS_FOR_LISTING_INDEX,
// MIN_POSTS_FOR_PRODUCT_CLASS), így nincs két külön igazság.
//
// Futás: az alkalmazásnak futnia kell a cél URL-en (build után: npm start),
// utána: npm run seo:audit   (vagy: npx tsx scripts/seo-audit.ts)
// Cél felülírása: SEO_AUDIT_BASE_URL=http://localhost:3100 npm run seo:audit

import { prisma } from '../src/lib/prisma';
import { MIN_POSTS_FOR_LISTING_INDEX } from '../src/lib/seo';
import {
  MIN_POSTS_FOR_PRODUCT_CLASS,
  productClassCounts,
} from '../src/lib/productClasses';
import { isAdultContent } from '../src/lib/adultContent';
import { listComparePairs, vsSitemapPairs } from '../src/lib/compare';

// A data.ts-beli segéd lokális mása: a data.ts-et szándékosan NEM importáljuk
// (a React cache()-je sima Node-ban nem hívható — lásd fent).
function safeParseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

// Megjegyzés: a src/lib/data.ts-t szándékosan NEM importáljuk (a React cache()-je
// sima Node-ban nem hívható, lásd a check-product-classes.ts konvencióját) —
// a rangsorolható cikkeket itt kérjük le közvetlenül, ugyanazzal a select-tel,
// amit a getRankablePosts is használ.

const BASE_URL = process.env.SEO_AUDIT_BASE_URL || 'http://localhost:3000';

type Check = {
  label: string;
  url: string;
  // Elvárt JSON-LD @type értékek (mindnekelvény jelen kell lennie).
  // A layout minden oldalra tesz WebSite + Organization sémát, ezért az itt
  // felsoroltak az oldal SAJÁT, ezen felüli sémái.
  jsonLdTypes: string[];
};

async function resolveChecks(): Promise<Check[]> {
  const publishedWhere = { status: 'PUBLISHED', publishedAt: { lte: new Date() } };
  const checks: Check[] = [
    { label: 'Főoldal', url: `${BASE_URL}/`, jsonLdTypes: [] },
    {
      label: 'Karácsonyi hub',
      url: `${BASE_URL}/karacsony`,
      jsonLdTypes: ['ItemList'],
    },
    {
      label: 'Black Friday hub',
      url: `${BASE_URL}/black-friday`,
      jsonLdTypes: ['ItemList'],
    },
  ];

  // Legfrissebb, nem 18+ cikk (a kapuzott oldal a hozzájárulás előtt nem a
  // teljes cikket rendereli, ott a cikk-sémák jogosan hiányoznak)
  try {
    const posts = await prisma.post.findMany({
      where: publishedWhere,
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        productName: true,
        productBrand: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    });
    const plain = posts.find(
      (p) =>
        !isAdultContent({
          ...p,
          tags: p.tags.map(({ tag }) => ({ tag })),
        } as Parameters<typeof isAdultContent>[0])
    );
    if (plain) {
      checks.push({
        label: 'Cikkoldal',
        url: `${BASE_URL}/blog/${plain.slug}`,
        jsonLdTypes: ['BreadcrumbList', 'Review|BlogPosting'],
      });
    }
  } catch {
    console.warn('  (DB hiba: cikkoldal kimaradt az auditból)');
  }

  // Legtöbb cikkel rendelkező kategória és címke
  try {
    const categories = await prisma.category.findMany({
      select: { slug: true, _count: { select: { posts: { where: publishedWhere } } } },
    });
    const bestCategory = categories.sort((a, b) => b._count.posts - a._count.posts)[0];
    if (bestCategory) {
      checks.push({
        label: 'Kategóriaoldal',
        url: `${BASE_URL}/kategoria/${bestCategory.slug}`,
        jsonLdTypes: ['BreadcrumbList'],
      });
    }
  } catch {
    console.warn('  (DB hiba: kategóriaoldal kimaradt az auditból)');
  }

  try {
    const tags = await prisma.tag.findMany({
      select: { slug: true, _count: { select: { posts: { where: { post: publishedWhere } } } } },
    });
    const bestTag = tags.sort((a, b) => b._count.posts - a._count.posts)[0];
    if (bestTag) {
      checks.push({
        label: 'Címkeoldal',
        url: `${BASE_URL}/cimke/${bestTag.slug}`,
        jsonLdTypes: ['BreadcrumbList'],
      });
    }
  } catch {
    console.warn('  (DB hiba: címkeoldal kimaradt az auditból)');
  }

  // Legtöbb cikkel rendelkező márka
  try {
    const brands = await prisma.post.groupBy({
      by: ['productBrand'],
      where: { ...publishedWhere, productBrand: { not: null } },
      _count: { productBrand: true },
    });
    const best = brands.sort((a, b) => b._count.productBrand - a._count.productBrand)[0];
    if (best?.productBrand) {
      const slug = best.productBrand
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      checks.push({
        label: 'Márkaoldal',
        url: `${BASE_URL}/marka/${slug}`,
        jsonLdTypes: ['BreadcrumbList', 'ItemList'],
      });
    }
  } catch {
    console.warn('  (DB hiba: márkaoldal kimaradt az auditból)');
  }

  // Legnagyobb indexelhető termékosztály-toplista
  try {
    const rankable = await prisma.post.findMany({
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
        tags: { select: { tag: { select: { name: true } } } },
        pros: true,
        cons: true,
      },
      orderBy: { publishedAt: 'desc' },
    });
    const parsedPosts = rankable.map((row) => ({
      ...row,
      pros: safeParseStringArray(row.pros),
      cons: safeParseStringArray(row.cons),
    }));
    const counts = productClassCounts(parsedPosts)
      .filter(({ count }) => count >= MIN_POSTS_FOR_PRODUCT_CLASS)
      .sort((a, b) => b.count - a.count);
    if (counts[0]) {
      checks.push({
        label: 'Termékosztály-toplista',
        url: `${BASE_URL}/legjobb/${counts[0].cls.slug}`,
        jsonLdTypes: ['BreadcrumbList', 'ItemList'],
      });
    }

    // A legjobb indexelt vs-páros (/osszehasonlitas/a-vs-b) — ugyanaz a
    // sitemap-küszöb (vsSitemapPairs), amit a sitemap is használ.
    const pair = vsSitemapPairs(listComparePairs(parsedPosts))[0];
    if (pair) {
      checks.push({
        label: 'Vs-páros oldal',
        url: `${BASE_URL}/osszehasonlitas/${pair.slug}`,
        jsonLdTypes: ['BreadcrumbList', 'FAQPage'],
      });
      checks.push({
        label: 'Vs-hub',
        url: `${BASE_URL}/osszehasonlitas`,
        jsonLdTypes: ['BreadcrumbList'],
      });
    }
  } catch {
    console.warn('  (DB hiba: toplistalap és vs-oldalak kimaradtak az auditból)');
  }

  return checks;
}

function extractJsonLdTypes(html: string): string[] {
  const types: string[] = [];
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    try {
      const parsed = JSON.parse(m[1]);
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (typeof node?.['@type'] === 'string') types.push(node['@type']);
        else if (Array.isArray(node?.['@type'])) types.push(...node['@type']);
      }
    } catch {
      // Érvénytelen JSON-LD: külön hibaként jelentjük, nem itt
      types.push('<<INVALID_JSON>>');
    }
  }
  return types;
}

function metaContent(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m?.[1]?.trim() || null;
}

async function audit(): Promise<number> {
  let checks: Check[];
  try {
    checks = await resolveChecks();
  } finally {
    await prisma.$disconnect();
  }

  console.log(`SEO audit ezen: ${BASE_URL} (${checks.length} oldal)\n`);

  let failures = 0;
  for (const check of checks) {
    const problems: string[] = [];
    let html = '';
    try {
      const res = await fetch(check.url, { signal: AbortSignal.timeout(15000) });
      if (res.status !== 200) {
        problems.push(`HTTP ${res.status} (200-ast várunk)`);
      }
      html = await res.text();
    } catch (e) {
      problems.push(
        `nem elérhető: ${e instanceof Error ? e.message : String(e)} — fut az alkalmazás ezen az URL-en?`
      );
    }

    if (html) {
      // og:image: kötelező, tartalommal (a shallow merge buktatója)
      const ogImage = metaContent(html, /<meta property="og:image" content="([^"]*)"/);
      if (!ogImage) problems.push('hiányzó og:image');
      else if (!/^https?:\/\//.test(ogImage)) problems.push(`og:image nem abszolút URL: ${ogImage}`);

      // canonical: kötelező
      const canonical = metaContent(html, /<link rel="canonical" href="([^"]*)"/);
      if (!canonical) problems.push('hiányzó canonical');
      else if (!/^https?:\/\//.test(canonical)) problems.push(`canonical nem abszolút URL: ${canonical}`);

      // JSON-LD: az elvárt típusok megvannak? ("A|B" = bármelyik jó)
      const types = extractJsonLdTypes(html);
      if (types.includes('<<INVALID_JSON>>')) problems.push('érvénytelen JSON-LD blokk');
      for (const expected of check.jsonLdTypes) {
        const alternatives = expected.split('|');
        if (!alternatives.some((t) => types.includes(t))) {
          problems.push(`hiányzó JSON-LD: ${expected}`);
        }
      }
    }

    if (problems.length > 0) {
      failures += 1;
      console.log(`✘ ${check.label}  ${check.url}`);
      for (const p of problems) console.log(`    - ${p}`);
    } else {
      console.log(`✔ ${check.label}  ${check.url}`);
    }
  }

  console.log('');
  if (failures > 0) {
    console.error(`ELBUKOTT: ${failures}/${checks.length} oldal hibás SEO-metaadatokat ad vissza.`);
    return 1;
  }
  console.log(`Minden oldal rendben (${checks.length}/${checks.length}).`);
  return 0;
}

audit()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
