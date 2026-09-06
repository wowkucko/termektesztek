import { NextRequest, NextResponse } from 'next/server';
import { getPublishedPosts } from '@/lib/data';

const MAX_PAGE_SIZE = 24;

// GET /api/posts?categorySlug=&tagSlug=&search=&page=1&pageSize=12
// Publikus, csak olvasható lapozó API a mobil infinite scrollhoz.
// Minimális mezőkkel válaszol (gyors JSON).
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get('pageSize')) || 12));
  const categorySlug = params.get('categorySlug') || undefined;
  const tagSlug = params.get('tagSlug') || undefined;
  const search = params.get('search') || undefined;

  const { posts, total } = await getPublishedPosts({
    take: pageSize,
    skip: (page - 1) * pageSize,
    categorySlug,
    tagSlug,
    search,
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      coverImage: p.coverImage,
      coverImageAlt: p.coverImageAlt,
      rating: p.rating,
      publishedAt: p.publishedAt,
      category: { name: p.category.name, slug: p.category.slug },
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  });
}
