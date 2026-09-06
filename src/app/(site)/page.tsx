import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getFeaturedPost, getPublishedPosts, getTestOfTheWeek, getCategoryTopPicks } from '@/lib/data';
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from '@/lib/seo';
import { formatDate, formatPriceFt } from '@/lib/utils';
import PostCard from '@/components/site/PostCard';
import TopPickStrip from '@/components/site/TopPickStrip';
import { RatingBadge } from '@/components/site/VerdictStamp';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: SITE_DESCRIPTION,
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
  },
};

export default async function HomePage() {
  const [featured, { posts, total }, picks] = await Promise.all([
    getFeaturedPost(),
    getPublishedPosts({ take: 9 }),
    getCategoryTopPicks(),
  ]);
  const testOfWeek = await getTestOfTheWeek(featured?.id);

  const latestPosts = posts.filter((p) => p.id !== featured?.id);
  const latest = posts[0] || featured;

  return (
    <div>
      <section className="container-page pt-14 pb-10">
        <div className="grid items-center gap-8 md:grid-cols-[1fr,280px]">
          <div className="max-w-2xl">
            <p className="font-sans text-sm font-semibold uppercase tracking-wide text-signal-600">
              Magyar nyelvű terméktesztek
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] text-ink sm:text-5xl">
              Terméktesztek minden kategóriában, magyarul.
            </h1>
            <p className="mt-4 font-body text-lg leading-relaxed text-ink/70">
              Független pontozás, valódi vásárlói vélemények és toplisták — hogy ne lőj mellé a
              vásárlásnál.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3 md:grid-cols-1">
            <div className="rounded-card border border-line bg-white p-4 text-center md:text-left">
              <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/45">
                Teszt
              </dt>
              <dd className="mt-1 font-display text-3xl font-bold text-ink">{total}</dd>
            </div>
            <div className="rounded-card border border-line bg-white p-4 text-center md:text-left">
              <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/45">
                Kategória
              </dt>
              <dd className="mt-1 font-display text-3xl font-bold text-ink">{picks.length}</dd>
            </div>
            <div className="rounded-card border border-line bg-white p-4 text-center md:text-left">
              <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/45">
                Frissítve
              </dt>
              <dd className="mt-1 font-sans text-sm font-semibold leading-snug text-ink">
                {latest?.publishedAt ? formatDate(latest.publishedAt) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {testOfWeek && (
        <section className="container-page pb-14" aria-label="A hét tesztje">
          <div className="overflow-hidden rounded-card bg-ink">
            <Link href={`/blog/${testOfWeek.slug}`} className="group grid md:grid-cols-2">
              <div className="relative aspect-[16/10] overflow-hidden md:aspect-auto md:min-h-[320px]">
                {testOfWeek.coverImage ? (
                  <Image
                    src={testOfWeek.coverImage}
                    alt={testOfWeek.coverImageAlt || testOfWeek.title}
                    fill
                    priority
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full min-h-[240px] w-full items-center justify-center font-display text-6xl text-white/20">
                    {testOfWeek.category.name.charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center gap-4 p-8 md:p-12">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-fit rounded-chip bg-signal px-2.5 py-1 font-sans text-xs font-semibold text-white">
                    A hét tesztje · {testOfWeek.category.name}
                  </span>
                  {testOfWeek.rating != null && <RatingBadge rating={testOfWeek.rating} size="lg" />}
                </div>
                <p className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
                  {testOfWeek.title}
                </p>
                <p className="font-body text-base leading-relaxed text-white/70">{testOfWeek.excerpt}</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {formatPriceFt(testOfWeek.priceFt) && (
                    <span className="font-sans text-sm text-white/70">
                      Aktuális ár:{' '}
                      <span className="font-bold text-white">{formatPriceFt(testOfWeek.priceFt)}</span>
                    </span>
                  )}
                  <span className="font-sans text-sm font-semibold text-white group-hover:underline">
                    Részletes teszt →
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {picks.length > 0 && (
        <section className="pb-14" aria-label="Toplisták">
          <div className="container-page mb-6 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold text-ink">Toplisták</h2>
            <p className="hidden font-sans text-sm text-ink/50 sm:block">Kategóriák győztesei</p>
          </div>
          <div className="container-page">
            <TopPickStrip picks={picks} />
          </div>
        </section>
      )}

      {featured && (
        <section className="container-page pb-14">
          <Link
            href={`/blog/${featured.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-white md:flex-row"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-teal-50 md:aspect-auto md:w-1/2">
              {featured.coverImage ? (
                <Image
                  src={featured.coverImage}
                  alt={featured.coverImageAlt || featured.title}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-6xl text-teal-200">
                  {featured.category.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-center gap-4 p-8 md:p-12">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-fit rounded-chip bg-teal-50 px-2.5 py-1 font-sans text-xs font-semibold text-teal-700">
                  Legfrissebb teszt · {featured.category.name}
                </span>
                {featured.rating != null && <RatingBadge rating={featured.rating} size="lg" />}
              </div>
              <h2 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
                {featured.title}
              </h2>
              <p className="font-body text-base leading-relaxed text-ink/65">{featured.excerpt}</p>
              {featured.publishedAt && (
                <p className="font-sans text-xs text-ink/45">{formatDate(featured.publishedAt)}</p>
              )}
            </div>
          </Link>
        </section>
      )}

      <section className="container-page pb-20">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold text-ink">Legfrissebb tesztek</h2>
        </div>

        {latestPosts.length === 0 ? (
          <p className="font-body text-ink/60">
            Még nincs publikált bejegyzés. Jelentkezz be az admin felületre az első cikk
            felvételéhez.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
