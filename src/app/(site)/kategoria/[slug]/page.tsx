import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryBySlug, getPublishedPosts, getRankablePosts } from '@/lib/data';
import { absoluteUrl, breadcrumbJsonLd, listingRobots } from '@/lib/seo';
import {
  MIN_POSTS_FOR_PRODUCT_CLASS,
  countProductClassPosts,
  productClassesForCategory,
} from '@/lib/productClasses';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import Pagination from '@/components/site/Pagination';
import InfinitePostList from '@/components/site/InfinitePostList';
import ProductClassLinks from '@/components/site/ProductClassLinks';
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
  // Kevés cikkes kategória vagy 2+ lap: duplikált/vékony lista - noindex, follow
  const { total } = await getPublishedPosts({ categorySlug: category.slug, take: 1 });
  return {
    title,
    description,
    robots: listingRobots(total, page),
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

  // A kategória termékosztály-toplistái ("legjobb air fryer", "legjobb porszívó"):
  // a kereslet termékosztály-szinten van, ezért innen is linkeljük őket. A vékony
  // osztályokat (< MIN cikk) nem linkeljük, mert azok noindexet kapnak.
  const classCandidates = productClassesForCategory(category.slug);
  const rankable = classCandidates.length > 0 ? await getRankablePosts() : [];
  const classLinks = classCandidates
    .map((cls) => ({ cls, count: countProductClassPosts(rankable, cls) }))
    .filter(({ count }) => count >= MIN_POSTS_FOR_PRODUCT_CLASS)
    .sort((a, b) => b.count - a.count)
    .map(({ cls, count }) => ({ href: `/legjobb/${cls.slug}`, label: `Legjobb ${cls.name} (${count} teszt)` }));

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
          <span className="font-sans text-xs font-semibold uppercase tracking-wide text-signal-700">
            🏆 Toplista
          </span>
          <span className="mt-0.5 block font-display text-lg font-bold text-ink">
            Legjobb {category.name.toLowerCase()} rangsor és összehasonlítás
          </span>
        </span>
        <span aria-hidden="true" className="font-display text-2xl text-signal-600">→</span>
      </Link>

      <ProductClassLinks
        className="mt-8"
        heading="Toplisták termékosztályonként"
        intro={`Nem tudod, melyik típus illik hozzád? Ezekben a rangsorokban a legjobbra értékelt modelleket találod ársáv szerint is, csak a ${category.name.toLowerCase()} kategóriából.`}
        links={classLinks}
      />

      <div className="mt-10">
        {posts.length === 0 ? (
          <p className="font-body text-ink/65">Ebben a kategóriában még nincs publikált teszt.</p>
        ) : (
          <InfinitePostList
            key={`kat-${category.slug}-p${page}`}
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
