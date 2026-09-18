import type { Metadata } from 'next';
import Link from 'next/link';
import { getRankablePosts } from '@/lib/data';
import {
  listComparePairs,
  VS_HUB_LIMIT,
  VS_SITEMAP_MIN_SCORE,
  VS_SITEMAP_LIMIT,
} from '@/lib/compare';
import { getProductClass } from '@/lib/productClasses';
import { absoluteUrl, defaultOgImages, breadcrumbJsonLd, SITE_NAME } from '@/lib/seo';

/**
 * /osszehasonlitas hub: a minőségi párosok termékosztályonként csoportosítva.
 * Feladata a vs-oldalak belső linkelése (discovery) és az emberi böngészés.
 * A párok ugyanabból a motorból jönnek, mint a cikken belüli táblázat —
 * itt csak azok jelennek meg, amelyek a vs-oldalakon is élnek.
 */

export const metadata: Metadata = {
  title: 'Termék-összehasonlítások: X vs Y párharcok a tesztjeinkből',
  description:
    'Azonos termékosztályú, összemérhető termékek egymás ellen: pontszám, ár, előnyök és hátrányok egy táblázatban a magyar nyelvű tesztjeink alapján.',
  alternates: { canonical: absoluteUrl('/osszehasonlitas') },
  openGraph: {
    title: `Termék-összehasonlítások | ${SITE_NAME}`,
    description:
      'X vs Y párharcok a tesztjeinkből: pontszám, ár, előnyök és hátrányok egy táblázatban.',
    url: absoluteUrl('/osszehasonlitas'),
    siteName: SITE_NAME,
    type: 'website',
    locale: 'hu_HU',
    images: defaultOgImages('Termék-összehasonlítások'),
  },
};

export default async function CompareHubPage() {
  const posts = await getRankablePosts();
  const pairs = listComparePairs(posts);

  // Csak azok a párok, amelyek vs-oldala valóban él (minőségi küszöb) —
  // így a hub sosem linkel 404-re. Limit: a lap mérete miatt.
  const livePairs = pairs
    .filter((p) => p.score >= VS_SITEMAP_MIN_SCORE)
    .slice(0, VS_HUB_LIMIT);

  // Csoportosítás az első közös termékosztály szerint
  const groups = new Map<string, typeof livePairs>();
  for (const pair of livePairs) {
    const arr = groups.get(pair.classSlug);
    if (arr) arr.push(pair);
    else groups.set(pair.classSlug, [pair]);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  const name = (p: { productBrand: string | null; productName: string | null; title: string }) =>
    [p.productBrand, p.productName].filter(Boolean).join(' — ') || p.title;

  return (
    <div className="container-page py-12">
      <header className="mb-10 max-w-3xl">
        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">
          Összehasonlítás
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
          Termék vs. termék: a párharcok
        </h1>
        <p className="mt-4 font-body text-base leading-relaxed text-ink/70">
          Csak azonos termékosztályú, valóban összemérhető modelleket állítunk egymással szemben:
          a pontszámok a nálunk megjelent tesztekből származnak, az árak tájékoztató jellegűek.
        </p>
      </header>

      {sortedGroups.length === 0 ? (
        <p className="font-body text-ink/60">
          Jelenleg nincs elég egymással összemérhető teszt egy párharc oldalhoz.
        </p>
      ) : (
        <div className="space-y-12">
          {sortedGroups.map(([classSlug, classPairs]) => {
            const cls = getProductClass(classSlug);
            return (
              <section key={classSlug} aria-label={cls?.name ?? classSlug}>
                <h2 className="mb-4 font-display text-xl font-bold text-ink">
                  {cls?.name ? `Összehasonlítások: ${cls.name}` : 'További összehasonlítások'}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {classPairs.map((pair) => (
                    <li key={pair.slug}>
                      <Link
                        href={`/osszehasonlitas/${pair.slug}`}
                        className="group block h-full rounded-card border border-line bg-white p-4 shadow-card transition-colors hover:border-teal-600"
                      >
                        <p className="font-display text-sm font-bold leading-snug text-ink transition-colors group-hover:text-teal-600">
                          {name(pair.a)} vs. {name(pair.b)}
                        </p>
                        <p className="mt-2 flex items-center gap-2 font-sans text-xs text-ink/60">
                          <span className="font-semibold text-teal-700">
                            {pair.a.rating ?? '—'} vs. {pair.b.rating ?? '—'} pont
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{pair.reasons[0]}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Kezdőlap', path: '/' },
              { name: 'Összehasonlítások', path: '/osszehasonlitas' },
            ])
          ),
        }}
      />
    </div>
  );
}
