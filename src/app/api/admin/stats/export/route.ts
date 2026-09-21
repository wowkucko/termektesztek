import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CSV export a statisztika-oldal táblájához: ugyanazok a sorok (cím, kategória,
// megtekintések, affiliate kattintások, arány), a szűrőparamétereket átveszi
// (?q=&min=&sort= — ugyanaz, amit az oldal GET űrlapja küld).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const minViews = Math.max(0, parseInt(searchParams.get('min') || '0', 10) || 0);
  const sort = searchParams.get('sort') || 'views';

  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      views: true,
      affiliateClicks: true,
      affiliateUrl: true,
      publishedAt: true,
      category: { select: { name: true } },
    },
  });

  const rows = posts
    .filter((p) => p.views >= minViews)
    .filter((p) => !q || p.title.toLowerCase().includes(q))
    .map((p) => ({ ...p, ctr: p.views > 0 ? (p.affiliateClicks / p.views) * 100 : null }))
    .sort((a, b) => {
      switch (sort) {
        case 'clicks':
          return b.affiliateClicks - a.affiliateClicks || b.views - a.views;
        case 'ctr':
          return (b.ctr ?? -1) - (a.ctr ?? -1) || b.views - a.views;
        case 'recent':
          return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
        default:
          return b.views - a.views || b.affiliateClicks - a.affiliateClicks;
      }
    });

  // Excel-kompatibilis CSV: BOM + pontosvessző-elválasztó (hu locale)
  const csvLines = [
    'Cím;URL;Kategória;Megtekintések;Affiliate kattintás;Kattintási arány (%)',
    ...rows.map((r) =>
      [
        r.title.replace(/;/g, ','),
        `/blog/${r.slug}`,
        r.category.name.replace(/;/g, ','),
        String(r.views),
        String(r.affiliateClicks),
        r.ctr == null ? '' : r.ctr.toFixed(1).replace('.', ','),
      ].join(';')
    ),
  ];
  const csv = '\uFEFF' + csvLines.join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="statisztikak-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
