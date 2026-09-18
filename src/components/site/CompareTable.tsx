import Link from 'next/link';
import type { CompareMatch, ComparePost } from '@/lib/compare';
import { comparePairSlug, VS_SITEMAP_MIN_SCORE } from '@/lib/compare';
import { formatPriceFt } from '@/lib/utils';
import { RatingBadge } from '@/components/site/VerdictStamp';

/** A táblázat egy oszlopához kellő mezők (a current és a párosok ugyanezt viszik). */
export type CompareColumn = Pick<
  ComparePost,
  'id' | 'slug' | 'title' | 'rating' | 'priceFt' | 'productName' | 'productBrand' | 'affiliateUrl' | 'pros' | 'cons'
>;

/** A táblázat egy oszlopa: a current vagy egy páros, jelölve, hogy melyik. */
type Column = CompareColumn & { isCurrent: boolean; reasons?: string[]; score?: number };

/**
 * Cikken belüli összehasonlító táblázat: a tesztelt termék és 1-2 azonos
 * termékosztályú, valóban hasonló páros (lásd src/lib/compare.ts — a párok
 * pontozáson alapulnak, közös márka/címke nélkül nem jönnek létre).
 * Csak a cikkekben tényleg leírt előnyt/hátrányt mutat (pros/cons), nem talál fel új állításokat.
 */
export default function CompareTable({
  current,
  matches,
}: {
  current: CompareColumn;
  matches: CompareMatch[];
}) {
  if (matches.length === 0) return null;

  const name = (p: CompareColumn) =>
    [p.productBrand, p.productName].filter(Boolean).join(' — ') || p.title;

  // A "miért ezek a párok" sor: egyedi okok a párosok jelzéseiből
  const reasonList = [...new Set(matches.flatMap((m) => m.reasons))].join(', ');

  const columns: Column[] = [
    { ...current, isCurrent: true },
    ...matches.map((m) => ({ ...m.post, isCurrent: false, reasons: m.reasons, score: m.score })),
  ];

  return (
    <section aria-label="Hasonló termékek összehasonlítása" className="not-prose my-8">
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div className="border-b border-line bg-teal-50/60 px-5 py-4">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">
            Összehasonlítás hasonló termékekkel
          </p>
          <p className="mt-1 font-body text-sm leading-relaxed text-ink/70">
            Ugyanabból a termékosztályból, valóban összemérhető modellek — az értékelések a blog
            pontszámai, az árak tájékoztató jellegűek.
          </p>
        </div>

        {/* Mobilon vízszintesen görgethető, asztalon egyenletes oszlopok */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink/55">
                  &nbsp;
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    className={`px-5 py-3 ${col.isCurrent ? 'bg-teal-50/50' : ''}`}
                  >
                    {col.isCurrent ? (
                      <>
                        <span className="block font-sans text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                          Ezt teszteltük
                        </span>
                        <span className="mt-0.5 block font-display text-sm font-bold leading-snug text-ink">
                          {name(col)}
                        </span>
                      </>
                    ) : (
                      <Link
                        href={`/blog/${col.slug}`}
                        className="font-display text-sm font-bold leading-snug text-ink transition-colors hover:text-teal-600"
                      >
                        {name(col)}
                      </Link>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-sans text-sm">
              <tr>
                <th scope="row" className="px-5 py-3 font-semibold text-ink/55">
                  Pontszám
                </th>
                {columns.map((col) => (
                  <td key={col.id} className={`px-5 py-3 ${col.isCurrent ? 'bg-teal-50/50' : ''}`}>
                    {col.rating != null ? <RatingBadge rating={col.rating} size="sm" /> : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-5 py-3 font-semibold text-ink/55">
                  Ár (tájékoztató)
                </th>
                {columns.map((col) => (
                  <td key={col.id} className={`px-5 py-3 font-semibold text-ink ${col.isCurrent ? 'bg-teal-50/50' : ''}`}>
                    {formatPriceFt(col.priceFt) || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-5 py-3 align-top font-semibold text-ink/55">
                  Fő előny
                </th>
                {columns.map((col) => (
                  <td key={col.id} className={`px-5 py-3 align-top text-ink/75 ${col.isCurrent ? 'bg-teal-50/50' : ''}`}>
                    {col.pros[0] ?? '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-5 py-3 align-top font-semibold text-ink/55">
                  Fő hátrány
                </th>
                {columns.map((col) => (
                  <td key={col.id} className={`px-5 py-3 align-top text-ink/75 ${col.isCurrent ? 'bg-teal-50/50' : ''}`}>
                    {col.cons[0] ?? '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-5 py-3" />
                {columns.map((col) => (
                  <td key={col.id} className={`px-5 py-4 ${col.isCurrent ? 'bg-teal-50/50' : ''}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      {col.affiliateUrl && (
                        <a
                          href={col.affiliateUrl}
                          target="_blank"
                          rel="sponsored noopener noreferrer"
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          Megvásárlom
                        </a>
                      )}
                      {!col.isCurrent && (
                        <Link
                          href={`/blog/${col.slug}`}
                          className="inline-block py-2 font-sans text-sm font-semibold text-teal-700 hover:underline"
                        >
                          Részletes teszt →
                        </Link>
                      )}
                      {/* Minőségi párosnál a vs-oldal is él — külön link rá */}
                      {!col.isCurrent &&
                        col.score != null &&
                        col.score >= VS_SITEMAP_MIN_SCORE &&
                        current.slug && (
                          <Link
                            href={`/osszehasonlitas/${comparePairSlug(current.slug, col.slug)}`}
                            className="inline-block py-2 font-sans text-sm font-semibold text-ink/70 hover:text-teal-700 hover:underline"
                          >
                            Párharc →
                          </Link>
                        )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-t border-line bg-paper/60 px-5 py-3">
          <p className="font-sans text-xs leading-relaxed text-ink/55">
            Miért ezek a párok? {reasonList}. Csak azonos termékosztályú, összemérhető
            modelleket hasonlítunk össze.
          </p>
        </div>
      </div>
    </section>
  );
}
