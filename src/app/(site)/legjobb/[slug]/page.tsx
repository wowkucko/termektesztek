import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getAllCategories, getCategoryBySlug, getTopRatedPosts } from '@/lib/data';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';
import { formatPriceFt } from '@/lib/utils';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import { RatingBadge } from '@/components/site/VerdictStamp';

export const revalidate = 3600;

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

type Props = { params: { slug: string }; searchParams: { maxAr?: string } };

const PRICE_BANDS = [
  { label: 'Mind', value: null as number | null },
  { label: '50 ezer Ft alatt', value: 50000 },
  { label: '100 ezer Ft alatt', value: 100000 },
  { label: '200 ezer Ft alatt', value: 200000 },
];

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return {};
  const year = new Date().getFullYear();
  const maxAr = Number(searchParams.maxAr) || null;
  const band = PRICE_BANDS.find((b) => b.value === maxAr);
  const title = `Legjobb ${category.name.toLowerCase()} ${year}${band?.value ? ` – ${band.label.toLowerCase()}` : ''} – toplista és összehasonlítás`;
  const description = `A legjobbra értékelt ${category.name.toLowerCase()} termékek rangsorolva${band?.value ? `, ${band.label.toLowerCase()}` : ''}, magyar nyelvű tesztek alapján. Összehasonlító táblázat pontszámokkal, előnyökkel és vásárlási linkekkel.`;
  return {
    title,
    description,
    // A szűrt nézet duplikált tartalom - a canonical mindig az alap URL-re mutat
    alternates: { canonical: absoluteUrl(`/legjobb/${category.slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/legjobb/${category.slug}`) },
  };
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default async function ToplistPage({ params, searchParams }: Props) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) notFound();

  const year = new Date().getFullYear();
  const maxAr = Number(searchParams.maxAr) || null;
  const activeBand = PRICE_BANDS.find((b) => b.value === maxAr) ?? PRICE_BANDS[0];
  const top = await getTopRatedPosts(category.slug, 10, maxAr);
  const catName = category.name.toLowerCase();
  const hasPrices = top.some((p) => p.priceFt != null);

  const crumbs = [
    { name: 'Kezdőlap', href: '/' },
    { name: category.name, href: `/kategoria/${category.slug}` },
    { name: `Legjobb ${catName} ${year}` },
  ];

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Legjobb ${catName} ${year}`,
    description: `A legjobbra értékelt ${catName} termékek rangsora.`,
    numberOfItems: top.length,
    itemListElement: top.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/blog/${p.slug}`),
      name: p.productName || p.title,
    })),
  };

  return (
    <article className="container-page py-10 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.href || `/legjobb/${category.slug}` })))
          ),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <Breadcrumbs items={crumbs} />

      <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-wide text-signal-600">
        🏆 Toplista · {year}
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        Legjobb {catName} {year}: rangsor és összehasonlítás
      </h1>
      <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-ink/70">
        {category.description ||
          `Összegyűjtöttük a legjobbra értékelt ${catName} termékeket az oldalon megjelent magyar nyelvű tesztek alapján. A sorrendet a tesztjeinkben adott pontszámok határozzák meg, így egy pillantással láthatod, melyik termékkel járhatsz a legjobban.`}{' '}
        Mindegyikhez részletes tesztet is találsz előnyökkel, hátrányokkal és vásárlói
        vélemények összesítésével.
      </p>

      {hasPrices && (
        <div className="mt-6 flex flex-wrap gap-2">
          {PRICE_BANDS.map((b) => {
            const isActive = (b.value ?? null) === (activeBand.value ?? null);
            const href = b.value == null ? `/legjobb/${category.slug}` : `/legjobb/${category.slug}?maxAr=${b.value}`;
            return (
              <Link
                key={b.label}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`rounded-chip px-3.5 py-1.5 font-sans text-sm transition-colors ${
                  isActive
                    ? 'bg-ink text-white'
                    : 'border border-ink/15 bg-white text-ink/70 hover:border-teal-500 hover:text-teal-600'
                }`}
              >
                {b.label}
              </Link>
            );
          })}
        </div>
      )}

      {top.length === 0 ? (
        <p className="mt-10 font-body text-ink/60">
          Ebben a kategóriában még nincs értékelt teszt. Nézd meg az összes{' '}
          <Link href={`/kategoria/${category.slug}`} className="font-medium text-teal-600 hover:underline">
            {catName} tesztet
          </Link>
          .
        </p>
      ) : (
        <>
          <h2 className="mt-12 font-display text-2xl font-bold text-ink">Összehasonlító táblázat</h2>
          <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Termék</th>
                  <th className="px-4 py-3 font-medium">Pontszám</th>
                  {hasPrices && <th className="px-4 py-3 font-medium">Ár</th>}
                  <th className="px-4 py-3 font-medium text-right">Teszt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {top.map((p, i) => (
                  <tr key={p.id} className="font-sans text-sm">
                    <td className="px-4 py-3 text-lg">{MEDALS[i] || `${i + 1}.`}</td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {[p.productBrand, p.productName].filter(Boolean).join(' — ') || p.title}
                    </td>
                    <td className="px-4 py-3">
                      {p.rating != null ? (
                        <span className="font-semibold text-teal-700">{p.rating.toFixed(1)}/10</span>
                      ) : (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                    {hasPrices && (
                      <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                        {formatPriceFt(p.priceFt) ?? <span className="text-ink/30">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <Link href={`/blog/${p.slug}`} className="font-medium text-teal-600 hover:underline">
                        Elolvasom →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-14 font-display text-2xl font-bold text-ink">Részletes rangsor</h2>
          <div className="mt-6 space-y-6">
            {top.map((p, i) => (
              <section
                key={p.id}
                className={`overflow-hidden rounded-card border bg-white ${
                  i === 0 ? 'border-signal/40 shadow-card' : 'border-line'
                }`}
              >
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
                  {p.coverImage && (
                    <Link
                      href={`/blog/${p.slug}`}
                      className="relative block aspect-[16/10] w-full shrink-0 overflow-hidden rounded-tight bg-teal-50 sm:w-56"
                    >
                      <Image
                        src={p.coverImage}
                        alt={p.coverImageAlt || p.title}
                        fill
                        sizes="224px"
                        className="object-cover"
                      />
                    </Link>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold text-ink">
                        {MEDALS[i] || `${i + 1}.`}
                      </span>
                      {p.rating != null && <RatingBadge rating={p.rating} size="sm" />}
                    </div>
                    <Link href={`/blog/${p.slug}`} className="group">
                      <h3 className="mt-2 font-display text-xl font-bold leading-snug text-ink group-hover:text-teal-700">
                        {[p.productBrand, p.productName].filter(Boolean).join(' — ') || p.title}
                      </h3>
                    </Link>
                    <p className="mt-2 font-body text-sm leading-relaxed text-ink/65">{p.excerpt}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/blog/${p.slug}`} className="btn-secondary">
                        Részletes teszt
                      </Link>
                      {p.affiliateUrl && (
                        <a
                          href={p.affiliateUrl}
                          target="_blank"
                          rel="sponsored noopener noreferrer"
                          className="btn-primary"
                        >
                          Termék megvásárlása
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
