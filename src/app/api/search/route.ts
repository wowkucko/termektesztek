import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/search?q=... - élő keresési találatok a header keresőjéhez.
// Publikus: csak publikált cikkeket ad, minimális adattal (gyors render).
export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // SQLite LIKE: a kis-nagybetű érzékenység ASCII-nél nem számít,
  // az ékezeteseknél a q-t ékezetes és ékezet nélküli változatban is keressük.
  const deaccent = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ő/g, 'o')
      .replace(/ű/g, 'u');

  const q2 = deaccent(q);
  const like = { contains: q };
  const like2 = { contains: q2 };

  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [
        { title: like },
        { title: like2 },
        { excerpt: like },
        { excerpt: like2 },
        { productName: like },
        { productName: like2 },
        { productBrand: like },
        { productBrand: like2 },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      rating: true,
      category: { select: { name: true } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 6,
  });

  return NextResponse.json({
    results: posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt.slice(0, 90),
      coverImage: p.coverImage,
      rating: p.rating,
      categoryName: p.category.name,
    })),
  });
}
