import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryBySlug, getPublishedPosts } from '@/lib/data';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import Pagination from '@/components/site/Pagination';
import InfinitePostList from '@/components/site/InfinitePostList';
import { toClientPosts } from '@/lib/utils';

export const revalidate = 3600;

const PAGE_SIZE = 12;

type Props = { params: { slug: string }; searchParams: { page?: string } };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return {};
  const page = Math.max(1, Number(searchParams.page) || 1);
  const title = `${category.name} tesztek`;
  const description = category.description || `Az összes ${category.name.toLowerCase()} kategóriába tartozó termékteszt egy helyen.`;
  return {
    title,
    description,
    // A 2+ oldalak duplikált tartalom - ne indexeljük őket, de a linkeket kövessük
    robots: page > 1 ? { index: false, follow: true } : undefined,
    alternates: { canonical: absoluteUrl(`/kategoria/${category.slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/kategoria/${category.slug}`) },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) notFound();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const { posts, total } = await getPublishedPosts({
    categorySlug: category.slug,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  const crumbs = [
    { name: 'Kezdőlap', href: '/' },
    { name: category.name },
  ];

  return (
    <div className="container-page py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.href || `/kategoria/${category.slug}` })))
          ),
        }}
      />

      <Breadcrumbs items={crumbs} />

      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">{category.name}</h1>
      {category.description ? (
        <p className="mt-3 max-w-2xl font-body text-base leading-relaxed text-ink/65">
          {category.description}
        </p>
      ) : (
        <p className="mt-3 max-w-2xl font-body text-base leading-relaxed text-ink/65">
          Az összes {category.name.toLowerCase()} kategóriába tartozó magyar nyelvű termékteszt
          egy helyen: részletes bemutatók, vásárlói vélemények összesítése, előnyök és hátrányok,
          valamint egyértelmű verdikt pontozással, hogy könnyebb legyen a választás.
        </p>
      )}

      <Link
        href={`/legjobb/${category.slug}`}
        className="mt-6 flex items-center justify-between gap-4 rounded-card border border-signal/30 bg-signal/5 p-5 transition-colors hover:border-signal"
      >
        <span>
          <span className="font-sans text-xs font-semibold uppercase tracking-wide text-signal-600">
            🏆 Toplista
          </span>
          <span className="mt-0.5 block font-display text-lg font-bold text-ink">
            Legjobb {category.name.toLowerCase()} rangsor és összehasonlítás
          </span>
        </span>
        <span aria-hidden="true" className="font-display text-2xl text-signal-600">→</span>
      </Link>

      <div className="mt-10">
        {posts.length === 0 ? (
          <p className="font-body text-ink/60">Ebben a kategóriában még nincs publikált teszt.</p>
        ) : (
          <InfinitePostList
            initial={toClientPosts(posts)}
            total={total}
            pageSize={PAGE_SIZE}
            query={{ categorySlug: category.slug }}
            pagination={
              <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath={`/kategoria/${category.slug}`} />
            }
          />
        )}
      </div>
    </div>
  );
}
