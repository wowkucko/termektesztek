import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { MIN_POSTS_FOR_LISTING_INDEX, SITE_URL } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const publishedWhere = { status: 'PUBLISHED', publishedAt: { lte: now } };

  const [posts, categories, tags] = await Promise.all([
    prisma.post.findMany({
      where: publishedWhere,
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({ select: { slug: true } }),
    // A címkeoldalak nagy része 1-2 cikkes, vékony listaoldal: ezeket nem
    // érdemes a sitemapben kínálni, mert elviszik a crawl budgetet a cikkek
    // elől (ráadásul duplikálják a cikklistát). A küszöb alattiak noindexet
    // kapnak, de a linkjeik követhetők maradnak.
    prisma.tag.findMany({
      select: {
        slug: true,
        _count: {
          select: { posts: { where: { post: publishedWhere } } },
        },
      },
    }),
  ]);

  const indexableTags = tags.filter((t) => t._count.posts >= MIN_POSTS_FOR_LISTING_INDEX);

  // A /kereses noindex - nem kerül a sitemapbe sem.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/karacsony`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/black-friday`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/rolunk`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/kategoria/${c.slug}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const tagRoutes: MetadataRoute.Sitemap = indexableTags.map((t) => ({
    url: `${SITE_URL}/cimke/${t.slug}`,
    changeFrequency: 'weekly',
    priority: 0.4,
  }));

  // Toplisták ("legjobb X" hub-oldalak) - erős keresőforgalmi oldalak
  const toplistRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/legjobb/${c.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // Márka-hubok: ide is csak a legalább MIN_POSTS_FOR_LISTING_INDEX cikkes
  // márkák kerülnek (a 285 márkából ~170-nek egyetlen cikke van).
  const brandSlugs = new Set<string>();
  const brandRoutes: MetadataRoute.Sitemap = [];
  try {
    const { getAllBrands } = await import('@/lib/data');
    for (const b of await getAllBrands()) {
      if (b.count < MIN_POSTS_FOR_LISTING_INDEX) continue;
      if (brandSlugs.has(b.slug)) continue;
      brandSlugs.add(b.slug);
      brandRoutes.push({ url: `${SITE_URL}/marka/${b.slug}`, changeFrequency: 'weekly', priority: 0.6 });
    }
  } catch {
    // DB-hiba esetén a sitemap a többi útvonallal így is legenerálódik
  }

  return [...staticRoutes, ...postRoutes, ...categoryRoutes, ...toplistRoutes, ...brandRoutes, ...tagRoutes];
}
