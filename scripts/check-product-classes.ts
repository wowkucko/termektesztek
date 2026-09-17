// Termékosztály-audit: osztályonként kilistázza, hány PUBLIKÁLT, értékelt cikket
// illeszt a kulcsszó-szabály, és mutat néhány példát. Ezzel ellenőrizhető, hogy a
// kulcsszavak nem fognak-e be rossz cikkeket (és hogy nem üres-e egy osztály).
//
// Futtatás: npm run classes:check   (vagy: npx tsx scripts/check-product-classes.ts)
import { PrismaClient } from '@prisma/client';
import {
  PRODUCT_CLASSES,
  MIN_POSTS_FOR_PRODUCT_CLASS,
  postMatchesProductClass,
  productClassHaystack,
} from '../src/lib/productClasses';

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      productName: true,
      productBrand: true,
      rating: true,
      priceFt: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  let thin = 0;
  for (const cls of PRODUCT_CLASSES) {
    const hits = posts.filter((p) => p.rating != null && postMatchesProductClass(p, cls));
    const prices = hits.filter((p) => p.priceFt != null).length;
    if (hits.length < MIN_POSTS_FOR_PRODUCT_CLASS) thin += 1;
    console.log(
      `${hits.length >= MIN_POSTS_FOR_PRODUCT_CLASS ? 'OK  ' : 'VEKONY'} ${cls.slug.padEnd(24)} ${String(hits.length).padStart(3)} cikk (árral: ${prices})`
    );
    for (const p of hits.slice(0, 3)) {
      console.log(`        - ${p.title.slice(0, 88)}`);
    }
  }

  console.log(
    `\n${PRODUCT_CLASSES.length} osztály, ebből vékony (<${MIN_POSTS_FOR_PRODUCT_CLASS} cikk): ${thin}`
  );

  // Ellenőrzés: minden cikk, ami EGY osztályba sem került (ezek maradnak osztály nélkül)
  const matched = new Set<string>();
  for (const cls of PRODUCT_CLASSES) {
    for (const p of posts) {
      if (p.rating != null && postMatchesProductClass(p, cls)) matched.add(p.slug);
    }
  }
  console.log(
    `Osztályba sorolt cikk: ${matched.size} / ${posts.length} (a többi kategória- és címkelistákból érhető el)`
  );
  console.log('Példa haystack:', productClassHaystack(posts[0]).slice(0, 120));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
