import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getRankablePosts } from '@/lib/data';
import type { RankablePost } from '@/lib/data';
import {
  listComparePairs,
  resolveComparePair,
  VS_SITEMAP_MIN_SCORE,
  vsSitemapPairs,
} from '@/lib/compare';
import { absoluteUrl, breadcrumbJsonLd, defaultOgImages, SITE_NAME } from '@/lib/seo';
import { formatPriceFt } from '@/lib/utils';
import { RatingBadge } from '@/components/site/VerdictStamp';

/**
 * /osszehasonlitas/a-vs-b: a cikken belüli összehasonlító táblázat párosaiból
 * készülő állóoldal ("X vs Y" keresésekre). Szigorú szabályok:
 *  - a páros CSAK akkor él, ha a compare-motor minősíti (azonos termékosztály,
 *    pontozott, nem kiegészítő, nem 18+, minőségi küszöb) — ellenkezőleg 404,
 *    így a URL-t nem lehet rossz párossal megbukni;
 *  - a canonical mindig az ábécérendi sorrendű slug, a csere-sorrend 308-cal
 *    odaírányít (nincs duplikált tartalom);
 *  - az alacsonyabb pontszámú párok noindex, follow (a crawl budget védelme).
 */

export const dynamicParams = true;

type PageProps = { params: { pair: string } };

/** Előre generálva: az indexelt (sitemapbe kerülő) párok. */
export async function generateStaticParams() {
  const posts = await getRankablePosts();
  return vsSitemapPairs(listComparePairs(posts)).map((p) => ({ pair: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const posts = await getRankablePosts();
  const resolved = resolveComparePair(params.pair, posts);
  if (!resolved) return {};

  const { a, b, canonical, match } = resolved;
  const name = (p: RankablePost) =>
    [p.productBrand, p.productName].filter(Boolean).join(' — ') || p.title;
  const title = `${name(a)} vs ${name(b)}`;
  const url = absoluteUrl(`/osszehasonlitas/${canonical}`);

  return {
    title,
    description: `${name(a)} és ${name(b)} egymás ellen: pontszám, ár, fő előnyök és hátrányok a magyar nyelvű tesztjeink alapján.`,
    alternates: { canonical: url },
    robots: match.score >= VS_SITEMAP_MIN_SCORE ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description: 'Két összemérhető termék párharcban: pontszám, ár, előnyök és hátrányok.',
      url,
      siteName: SITE_NAME,
      type: 'article',
      locale: 'hu_HU',
      images: defaultOgImages(title),
    },
  };
}

export default async function ComparePairPage({ params }: PageProps) {
  const posts = await getRankablePosts();
  const resolved = resolveComparePair(params.pair, posts);
  if (!resolved) notFound();

  const { a, b, canonical, match } = resolved;

  // Canonical mindig az ábécérendi slug: a csere-sorrend véglegesen odairányít.
  if (params.pair !== canonical) {
    permanentRedirect(`/osszehasonlitas/${canonical}`);
  }
  const name = (p: RankablePost) =>
    [p.productBrand, p.productName].filter(Boolean).join(' — ') || p.title;

  // Verdikt: csak a tényleges pontszámokból és árakból, semmi kitalált állítás.
  const winner = (a.rating ?? 0) >= (b.rating ?? 0) ? a : b;
  const loser = winner === a ? b : a;
  const diff = Math.abs((a.rating ?? 0) - (b.rating ?? 0));
  const verdict =
    diff < 0.3
      ? `A két termék pontszáma szinte azonos (${a.rating ?? '—'} vs. ${b.rating ?? '—'} pont): ebben a párharcban nem a pontszám, hanem az ár és a személyes preferencia dönt.`
      : `A mi tesztjeink alapján a ${name(winner)} áll jobban: ${winner.rating ?? '—'} pontra értékeltük, míg a ${name(loser)} ${loser.rating ?? '—'} pontot kapott.`;

  const priceSentence =
    a.priceFt != null && b.priceFt != null
      ? a.priceFt === b.priceFt
        ? 'A tájékoztató áruk jelenleg azonos.'
        : `A ${a.priceFt < b.priceFt ? name(a) : name(b)} a kedvezőbb árú: ${formatPriceFt(Math.min(a.priceFt, b.priceFt))} a ${formatPriceFt(Math.max(a.priceFt, b.priceFt))} ellenében.`
      : 'Az egyik termék árát jelenleg nem tudjuk megbízhatóan megjeleníteni.';

  // FAQ: a Google-elvárás szerint minden kérdés-válasz látható is az oldalon
  // (a Verdikt dobozban szerepel ugyanez a szöveg).
  const faqItems = [
    {
      q: `Melyik a jobb: ${name(a)} vagy ${name(b)}?`,
      a: verdict,
    },
    {
      q: `Melyik olcsóbb: ${name(a)} vagy ${name(b)}?`,
      a: priceSentence,
    },
  ];

  const cell = 'px-5 py-3 align-top';

  return (
    <div className="container-page py-12">
      <header className="mb-8 max-w-3xl">
        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">
          Összehasonlítás
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {name(a)} <span className="text-ink/40">vs</span> {name(b)}
        </h1>
        <p className="mt-3 font-sans text-xs leading-relaxed text-ink/55">
          Miért hasonlítjuk őket? {match.reasons.join(', ')}. Csak azonos termékosztályú,
          összemérhető modelleket állítunk egymással szemben.
        </p>
      </header>

      {/* Verdikt — ugyanaz a szöveg, ami a FAQPage sémában megy */}
      <section
        aria-label="Verdikt"
        className="mb-8 rounded-card border border-teal-600/30 bg-teal-50/50 p-5"
      >
        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">
          Verdikt
        </p>
        <p className="mt-2 font-body text-base leading-relaxed text-ink">{verdict}</p>
        <p className="mt-2 font-body text-sm leading-relaxed text-ink/70">{priceSentence}</p>
      </section>

      {/* A párharc táblázata: pontszám, ár, előny, hátrány, vásárlás */}
      <section aria-label="Az összehasonlítás részletei" className="not-prose">
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left font-sans text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink/55">
                    &nbsp;
                  </th>
                  {[a, b].map((p) => (
                    <th key={p.id} scope="col" className="px-5 py-3">
                      <Link
                        href={`/blog/${p.slug}`}
                        className="font-display text-sm font-bold leading-snug text-ink transition-colors hover:text-teal-600"
                      >
                        {name(p)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <th scope="row" className={`${cell} font-semibold text-ink/55`}>
                    Pontszám
                  </th>
                  {[a, b].map((p) => (
                    <td key={p.id} className={cell}>
                      {p.rating != null ? <RatingBadge rating={p.rating} size="sm" /> : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={`${cell} font-semibold text-ink/55`}>
                    Ár (tájékoztató)
                  </th>
                  {[a, b].map((p) => (
                    <td key={p.id} className={`${cell} font-semibold text-ink`}>
                      {formatPriceFt(p.priceFt) || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={`${cell} font-semibold text-ink/55`}>
                    Fő előny
                  </th>
                  {[a, b].map((p) => (
                    <td key={p.id} className={`${cell} text-ink/75`}>
                      {p.pros[0] ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={`${cell} font-semibold text-ink/55`}>
                    Fő hátrány
                  </th>
                  {[a, b].map((p) => (
                    <td key={p.id} className={`${cell} text-ink/75`}>
                      {p.cons[0] ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={cell} />
                  {[a, b].map((p) => (
                    <td key={p.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        {p.affiliateUrl && (
                          <a
                            href={p.affiliateUrl}
                            target="_blank"
                            rel="sponsored noopener noreferrer"
                            className="btn-primary px-4 py-2 text-sm"
                          >
                            Megvásárlom
                          </a>
                        )}
                        <Link
                          href={`/blog/${p.slug}`}
                          className="inline-block py-2 text-sm font-semibold text-teal-700 hover:underline"
                        >
                          Részletes teszt →
                        </Link>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="mt-6 font-sans text-sm text-ink/60">
        <Link href="/osszehasonlitas" className="font-semibold text-teal-700 hover:underline">
          ← További párharcok
        </Link>
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: 'Kezdőlap', path: '/' },
              { name: 'Összehasonlítások', path: '/osszehasonlitas' },
              { name: `${name(a)} vs ${name(b)}`, path: `/osszehasonlitas/${canonical}` },
            ]),
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqItems.map(({ q, a: answer }) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: answer },
              })),
            },
          ]),
        }}
      />
    </div>
  );
}
