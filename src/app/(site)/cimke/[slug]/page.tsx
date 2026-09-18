import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTagBySlug, getPublishedPostCountByTag, getPublishedPosts } from '@/lib/data';
import { absoluteUrl, breadcrumbJsonLd, listingRobots, defaultOgImages } from '@/lib/seo';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import Pagination from '@/components/site/Pagination';
import InfinitePostList from '@/components/site/InfinitePostList';
import { toClientPosts } from '@/lib/utils';

export const revalidate = 3600;

const PAGE_SIZE = 12;

type Props = { params: { slug: string }; searchParams: { page?: string } };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const tag = await getTagBySlug(params.slug);
  if (!tag) return {};
  const page = Math.max(1, Number(searchParams.page) || 1);
  const title = `#${tag.name} címkéjű tesztek`;
  // Vékony címkeoldal (kevés cikk): noindex, follow - a 2+ lapokkal együtt.
  const postCount = await getPublishedPostCountByTag(tag.slug);
  const description = `Az összes bejegyzés, amit a(z) ${tag.name} címkével láttunk el.`;
  return {
    title,
    description,
    robots: listingRobots(postCount, page),
    alternates: { canonical: absoluteUrl(`/cimke/${tag.slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/cimke/${tag.slug}`), images: defaultOgImages(title) },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const tag = await getTagBySlug(params.slug);
  if (!tag) notFound();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const { posts, total } = await getPublishedPosts({
    tagSlug: tag.slug,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  const crumbs = [{ name: 'Kezdőlap', href: '/' }, { name: `#${tag.name}` }];

  return (
    <div className="container-page py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.href || `/cimke/${tag.slug}` })))
          ),
        }}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">#{tag.name}</h1>

      <div className="mt-10">
        {posts.length === 0 ? (
          <p className="font-body text-ink/65">Ehhez a címkéhez még nincs publikált teszt.</p>
        ) : (
          <InfinitePostList
            key={`tag-${tag.slug}-p${page}`}
            initial={toClientPosts(posts)}
            total={total}
            pageSize={PAGE_SIZE}
            query={{ tagSlug: tag.slug }}
            pagination={
              <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath={`/cimke/${tag.slug}`} />
            }
          />
        )}
      </div>
    </div>
  );
}
