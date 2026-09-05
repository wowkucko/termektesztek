import Link from 'next/link';
import Image from 'next/image';
import { absoluteUrl } from '@/lib/seo';
import { formatPriceFt } from '@/lib/utils';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import { RatingBadge } from '@/components/site/VerdictStamp';
import type { PostWithRelations } from '@/lib/data';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function SeasonHub({
  kicker,
  title,
  intro,
  posts,
  crumbs,
}: {
  kicker: string;
  title: string;
  intro: string;
  posts: PostWithRelations[];
  crumbs: { name: string; href?: string }[];
}) {
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    description: intro,
    numberOfItems: posts.length,
    itemListElement: posts.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/blog/${p.slug}`),
      name: p.productName || p.title,
    })),
  };

  return (
    <article className="container-page py-10 pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Breadcrumbs items={crumbs} />

      <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-wide text-signal-600">{kicker}</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-ink/70">{intro}</p>

      {posts.length === 0 ? (
        <p className="mt-10 font-body text-ink/60">Hamarosan érkeznek az ajánlatok.</p>
      ) : (
        <>
          <h2 className="mt-12 font-display text-2xl font-bold text-ink">A mi választásunk</h2>
          <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Termék</th>
                  <th className="px-4 py-3 font-medium">Pontszám</th>
                  <th className="px-4 py-3 font-medium">Ár</th>
                  <th className="px-4 py-3 font-medium text-right">Teszt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {posts.map((p, i) => (
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
                    <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                      {formatPriceFt(p.priceFt) ?? <span className="text-ink/30">—</span>}
                    </td>
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

          <div className="mt-10 space-y-6">
            {posts.map((p, i) => (
              <section key={p.id} className="overflow-hidden rounded-card border border-line bg-white">
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
                      <span className="font-display text-lg font-bold text-ink">{MEDALS[i] || `${i + 1}.`}</span>
                      {p.rating != null && <RatingBadge rating={p.rating} size="sm" />}
                    </div>
                    <Link href={`/blog/${p.slug}`} className="group">
                      <h2 className="mt-2 font-display text-xl font-bold leading-snug text-ink group-hover:text-teal-700">
                        {[p.productBrand, p.productName].filter(Boolean).join(' — ') || p.title}
                      </h2>
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

          <p className="mt-10 max-w-3xl font-body text-sm text-ink/55">
            Az árak tájékoztató jellegűek és idővel változhatnak — a gombra kattintva mindig az
            aktuális árat látod a webshopban. További rangsorok:{' '}
            <Link href="/" className="font-medium text-teal-600 hover:underline">
              toplisták a főoldalon
            </Link>
            .
          </p>
        </>
      )}
    </article>
  );
}
