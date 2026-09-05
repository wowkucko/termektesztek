import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags] = await Promise.all([
    prisma.post.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({ select: { slug: true } }),
    prisma.tag.findMany({ select: { slug: true } }),
  ]);

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

  const tagRoutes: MetadataRoute.Sitemap = tags.map((t) => ({
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

  // Márka-hubok
  const brandSlugs = new Set<string>();
  const brandRoutes: MetadataRoute.Sitemap = [];
  try {
    const { getAllBrands } = await import('@/lib/data');
    for (const b of await getAllBrands()) {
      if (!brandSlugs.has(b.slug)) {
        brandSlugs.add(b.slug);
        brandRoutes.push({ url: `${SITE_URL}/marka/${b.slug}`, changeFrequency: 'weekly', priority: 0.6 });
      }
    }
  } catch {
    // DB-hiba esetén a sitemap a többi útvonallal így is legenerálódik
  }

  return [...staticRoutes, ...postRoutes, ...categoryRoutes, ...toplistRoutes, ...brandRoutes, ...tagRoutes];
}
