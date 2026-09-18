/**
 * Dinamikus OG-kép a toplistákhoz: /legjobb/{slug}/og
 * A toplista címét és a top-3 termékét pontszámmal mutatja — a "legjobb X"
 * oldalak a legmegosztottabb kontent, ezért kell, hogy önállóan álljon.
 * Stabil URL (nincs build-hash), a page metadata explicit images-szel hivatkozik rá.
 */
import { cache } from 'react';
import { getCategoryBySlug, getRankablePosts, getTopRatedPosts } from '@/lib/data';
import { getProductClass, rankProductClassPosts } from '@/lib/productClasses';
import { renderToplistOgPng } from '@/lib/ogImage';

export const runtime = 'nodejs';
export const revalidate = 86400;

const resolveSource = cache(
  async (slug: string): Promise<{ title: string; items: { name: string; score: string }[] } | null> => {
    const year = new Date().getFullYear();

    // Termékosztály-toplista (pl. "legjobb air fryer")
    const cls = getProductClass(slug);
    if (cls) {
      const all = await getRankablePosts();
      const ranked = rankProductClassPosts(all, cls, null, 3);
      if (ranked.length === 0) return null;
      return {
        title: `Legjobb ${cls.name.toLowerCase()} ${year}`,
        items: ranked.map((p) => ({
          name: [p.productBrand, p.productName].filter(Boolean).join(' ') || p.title,
          score: p.rating != null ? p.rating.toFixed(1) : '–',
        })),
      };
    }

    // Kategória-toplista (pl. "legjobb otthon és konyha")
    const category = await getCategoryBySlug(slug);
    if (!category) return null;
    const top = await getTopRatedPosts(category.slug, 3);
    if (top.length === 0) return null;
    return {
      title: `Legjobb ${category.name.toLowerCase()} ${year}`,
      items: top.map((p) => ({
        name: [p.productBrand, p.productName].filter(Boolean).join(' ') || p.title,
        score: p.rating != null ? p.rating.toFixed(1) : '–',
      })),
    };
  }
);

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const source = await resolveSource(params.slug);
    if (!source) return new Response(null, { status: 404 });

    const png = await renderToplistOgPng({
      kicker: '🏆 TOPLISTA',
      title: source.title,
      items: source.items,
    });

    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('[og-image] toplista kártya renderelési hiba:', error);
    return new Response(null, { status: 302, headers: { Location: '/og-default.png' } });
  }
}
