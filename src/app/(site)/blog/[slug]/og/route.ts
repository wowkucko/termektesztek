/**
 * Dinamikus OG-kép a cikkoldalakhoz: /blog/{slug}/og
 * A cikk címét, a tesztelt terméket és a pontszámot mutatja a site arculatával.
 * Stabil URL (nincs build-hash), ezért a page metadata explicit images-szel hivatkozik rá.
 */
import { getPostBySlug } from '@/lib/data';
import { renderPostOgPng } from '@/lib/ogImage';
import { truncate } from '@/lib/utils';

export const runtime = 'nodejs';
export const revalidate = 86400;

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const post = await getPostBySlug(params.slug);
    if (!post) return new Response(null, { status: 404 });

    const png = await renderPostOgPng({
      kicker: (post.category?.name ?? 'Termékteszt').toUpperCase(),
      title: post.seoTitle || post.title,
      rating: post.rating != null ? post.rating.toFixed(1) : null,
      footer: post.productName
        ? truncate([post.productBrand, post.productName].filter(Boolean).join(' — '), 64)
        : null,
    });

    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('[og-image] cikk kártya renderelési hiba:', error);
    return new Response(null, { status: 302, headers: { Location: '/og-default.png' } });
  }
}
