import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import SearchLogPanel from '@/components/admin/SearchLogPanel';

export const metadata: Metadata = { title: 'Keresések' };

export default async function AdminSearchLogPage() {
  const groups = await prisma.searchLog.groupBy({
    by: ['query'],
    _count: { _all: true },
    _avg: { resultCount: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 300,
  });

  const rows = groups
    .map((g) => ({
      query: g.query,
      count: g._count._all,
      avgResults: Math.round((g._avg.resultCount ?? 0) * 10) / 10,
      lastSearched: (g._max.createdAt ?? new Date()).toISOString(),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Keresési napló</h1>
      <div className="mt-6">
        <SearchLogPanel rows={rows} />
      </div>
    </div>
  );
}
