import type { Metadata } from 'next';
import { getPublishedPosts } from '@/lib/data';
import { prisma } from '@/lib/prisma';
import Pagination from '@/components/site/Pagination';
import InfinitePostList from '@/components/site/InfinitePostList';
import { toClientPosts } from '@/lib/utils';

const PAGE_SIZE = 12;

type Props = { searchParams: { q?: string; page?: string } };

export const metadata: Metadata = {
  title: 'Keresés',
  robots: { index: false, follow: true },
};

export const revalidate = 3600;

export default async function SearchPage({ searchParams }: Props) {
  const query = (searchParams.q || '').trim();
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { posts, total } = query
    ? await getPublishedPosts({ search: query, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE })
    : { posts: [], total: 0 };

  // Belső keresések naplózása (csak az 1. oldal): az adminon látszik, mire
  // keresnek találat nélkül - ezekből lesznek az új szinkron-tételek.
  if (query && page === 1) {
    await prisma.searchLog.create({ data: { query: query.slice(0, 120), resultCount: total } }).catch(() => {});
  }

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Keresés</h1>
      <p className="mt-3 font-body text-ink/60">
        {query ? `Találatok erre: „${query}”` : 'Írj be egy keresőszót a fejléc keresőmezőjébe.'}
      </p>

      <div className="mt-10">
        {query && posts.length === 0 && (
          <p className="font-body text-ink/60">Nincs találat. Próbálj meg más kulcsszót.</p>
        )}
        {posts.length > 0 && (
          <InfinitePostList
            initial={toClientPosts(posts)}
            total={total}
            pageSize={PAGE_SIZE}
            query={{ search: query }}
            pagination={
              <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/kereses" queryParam={query} />
            }
          />
        )}
      </div>
    </div>
  );
}
