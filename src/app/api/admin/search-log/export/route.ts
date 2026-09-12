import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/search-log/export?since=ISO&pruneDays=90
// Az éles keresési napló lekérése az itthoni gép számára (a push tükörképe).
// - since: csak az ezutáni sorok (a lehúzás könyvjelzője)
// - pruneDays: az ennél régebbi sorok törlése az éles DB-ből (nem nő a végtelenségig)
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const sinceRaw = params.get('since');
  const pruneDays = Math.min(365, Math.max(7, Number(params.get('pruneDays')) || 90));

  const since = sinceRaw ? new Date(sinceRaw) : new Date(0);
  const sinceValid = !isNaN(since.getTime()) ? since : new Date(0);

  // Régi sorok takarítása (mindig, limitáltan) + sablon-szemét
  // (pl. a Googlebot által szó szerint követett "?q={search_term_string}")
  // törlése korra való tekintet nélkül.
  const cutoff = new Date(Date.now() - pruneDays * 24 * 3600 * 1000);
  const pruned = await prisma.searchLog
    .deleteMany({
      where: {
        OR: [{ createdAt: { lt: cutoff } }, { query: { contains: '{' } }, { query: { contains: 'search_term_string' } }],
      },
    })
    .catch(() => ({ count: 0 }));

  const rows = await prisma.searchLog.findMany({
    // >= (nem >): a határon lévő sorok ismételt küldése ártalmatlan, mert az
    // itthoni oldal (query + createdAt) alapon deduplikál
    where: { createdAt: { gte: sinceValid } },
    orderBy: { createdAt: 'asc' },
    take: 1000,
    select: { query: true, resultCount: true, createdAt: true },
  });

  return NextResponse.json({ rows, pruned: pruned.count });
}
