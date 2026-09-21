import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getDailyTraffic } from '@/lib/traffic';
import DailyTrafficChart from '@/components/admin/DailyTrafficChart';

export const metadata: Metadata = { title: 'Statisztikák' };

type SearchParams = { q?: string; min?: string; sort?: string };

const SORTS = [
  { key: 'views', label: 'Legtöbb megtekintés' },
  { key: 'clicks', label: 'Legtöbb affiliate kattintás' },
  { key: 'ctr', label: 'Legjobb kattintási arány' },
  { key: 'recent', label: 'Legfrissebb cikk' },
] as const;

// Cikkenkénti forgalmi statisztika: megtekintések (Post.views, a cikkoldal
// inline scriptje számolja) és affiliate (Allegro) kattintások
// (Post.affiliateClicks — a cikk BÁRMELY affiliate linkjére kattintás egynek
// számít: termékdoboz, oldalsáv, stb. nem különböztetjük meg).
export default async function AdminStatsPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q || '').trim().toLowerCase();
  const minViews = Math.max(0, parseInt(searchParams.min || '0', 10) || 0);
  const sort = SORTS.some((s) => s.key === searchParams.sort) ? (searchParams.sort as string) : 'views';

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

  // Napi bontású forgalom az utolsó 30 napban (minden publikált cikk összege)
  // + az időszak legtöbbet nézett cikkei.
  const dailyPoints = await getDailyTraffic(30);

  // Összegző kártyák a SZŰRETLEN, teljes publikált állományról szólnak,
  // a táblázat pedig a szűrt eredményt mutatja.
  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const totalClicks = posts.reduce((sum, p) => sum + p.affiliateClicks, 0);
  const withLink = posts.filter((p) => p.affiliateUrl).length;
  const overallCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

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

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (minViews > 0) params.set('min', String(minViews));
  if (searchParams.sort) params.set('sort', searchParams.sort);
  const exportHref = `/api/admin/stats/export${params.toString() ? `?${params.toString()}` : ''}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Statisztikák</h1>
        <a href={exportHref} className="btn-secondary">
          ⬇ CSV letöltése
        </a>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-line bg-white p-5">
          <p className="font-display text-2xl font-bold text-ink">{totalViews.toLocaleString('hu-HU')}</p>
          <p className="mt-1 font-sans text-xs text-ink/50">Összes megtekintés (publikált cikkek)</p>
        </div>
        <div className="rounded-card border border-line bg-white p-5">
          <p className="font-display text-2xl font-bold text-ink">{totalClicks.toLocaleString('hu-HU')}</p>
          <p className="mt-1 font-sans text-xs text-ink/50">Affiliate kattintások (Allegro)</p>
        </div>
        <div className="rounded-card border border-line bg-white p-5">
          <p className="font-display text-2xl font-bold text-ink">{overallCtr.toFixed(1)}%</p>
          <p className="mt-1 font-sans text-xs text-ink/50">Átlagos kattintási arány</p>
        </div>
        <div className="rounded-card border border-line bg-white p-5">
          <p className="font-display text-2xl font-bold text-ink">
            {withLink}
            <span className="font-sans text-sm font-normal text-ink/40"> / {posts.length}</span>
          </p>
          <p className="mt-1 font-sans text-xs text-ink/50">Cikk affiliate linkkel</p>
        </div>
      </div>

      <div className="mt-6">
        <DailyTrafficChart points={dailyPoints} />
      </div>

      {/* GET űrlap: szerver-oldali szűrés kliens JS nélkül */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs font-medium text-ink/50">Keresés a címekben</span>
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q || ''}
            placeholder="pl. air fryer"
            className="w-56 rounded-tight border border-line px-3 py-2 font-sans text-sm text-ink focus:border-teal-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs font-medium text-ink/50">Minimum megtekintés</span>
          <input
            type="number"
            name="min"
            min={0}
            defaultValue={minViews > 0 ? minViews : ''}
            placeholder="0"
            className="w-40 rounded-tight border border-line px-3 py-2 font-sans text-sm text-ink focus:border-teal-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs font-medium text-ink/50">Rendezés</span>
          <select
            name="sort"
            defaultValue={sort}
            className="w-56 rounded-tight border border-line bg-white px-3 py-2 font-sans text-sm text-ink focus:border-teal-500 focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Szűrés
        </button>
        <Link href="/admin/statisztikak" className="font-sans text-sm font-medium text-ink/50 hover:text-ink/70">
          Törlés
        </Link>
      </form>

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Cikkek <span className="font-sans text-sm font-normal text-ink/40">({rows.length} találat)</span>
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 font-body text-sm text-ink/60">Nincs a szűrésnek megfelelő cikk.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-5 py-3 font-medium">Cikk</th>
                  <th className="px-5 py-3 font-medium">Kategória</th>
                  <th className="px-5 py-3 font-medium text-right">Megtekintések</th>
                  <th className="px-5 py-3 font-medium text-right">Affiliate kattintás</th>
                  <th className="px-5 py-3 font-medium text-right">Kattintási arány</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="font-sans text-sm">
                    <td className="max-w-md px-5 py-3">
                      <a
                        href={`/blog/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ink hover:text-teal-600 hover:underline"
                      >
                        {r.title}
                      </a>
                      {!r.affiliateUrl && (
                        <span className="ml-2 rounded-chip bg-ink/5 px-2 py-0.5 text-xs text-ink/40">
                          nincs affiliate link
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink/60">{r.category.name}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink">{r.views.toLocaleString('hu-HU')}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink">
                      {r.affiliateClicks.toLocaleString('hu-HU')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.ctr == null ? (
                        <span className="text-ink/40">—</span>
                      ) : (
                        <span
                          className={
                            r.ctr >= 5
                              ? 'font-semibold text-teal-700'
                              : r.ctr >= 2
                                ? 'font-semibold text-ink'
                                : 'text-ink/50'
                          }
                        >
                          {r.ctr.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 font-sans text-xs leading-relaxed text-ink/40">
        A megtekintés a cikkoldal betöltésekor számolódik — bot-forgalom (crawler, monitor), az
        azonos gépről 6 órán belüli ismételt betöltés és a puha újratöltés (F5) nem számol; egy IP
        napi 25 új cikknél többet nem számol (scraper-védelem). Az affiliate kattintás a cikk
        bármely Allegro linkjére történő kattintás — a termékdoboz és az oldalsáv egynek számít;
        azonos gépről 24 órán belül csak egyszer. Az arány kattintás / megtekintés.
      </p>
    </div>
  );
}
