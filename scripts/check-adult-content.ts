// 18+ tartalom audit: kilistázza, mely bejegyzéseknél jelenik meg a korhatár-kapu,
// és miért (mely kulcsszavak miatt). Így a szabályok ellenőrizhetők,
// a tévesen befogott vagy kimaradt cikkek pedig kézzel felülírhatók
// (MANUAL_ADULT_SLUGS / MANUAL_SAFE_SLUGS a src/lib/adultContent.ts-ben).
//
// Futtatás: npm run adult:check   (vagy: npx tsx scripts/check-adult-content.ts)
import { PrismaClient } from '@prisma/client';
import { detectAdultContent } from '../src/lib/adultContent';

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany({
    select: {
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      productName: true,
      productBrand: true,
      status: true,
      category: { select: { name: true, slug: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
    orderBy: { publishedAt: 'desc' },
  });

  const adult = posts.filter((p) => detectAdultContent(p).isAdult);

  for (const post of adult) {
    const result = detectAdultContent(post);
    console.log(
      `${post.status === 'PUBLISHED' ? 'PUB  ' : 'DRAFT'} /blog/${post.slug}\n     ${post.title}\n     [${result.reason}, pont: ${result.score}] ${result.matches.join(', ') || '-'}`
    );
  }

  console.log(
    `\n18+ kapu alá eső bejegyzés: ${adult.length} / ${posts.length} (ebből publikált: ${
      adult.filter((p) => p.status === 'PUBLISHED').length
    })`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
