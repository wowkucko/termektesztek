import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getAllBrands, getBrandBySlug, getBrandPosts } from '@/lib/data';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';
import { formatPriceFt } from '@/lib/utils';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import { RatingBadge } from '@/components/site/VerdictStamp';

export const revalidate = 3600;

export async function generateStaticParams() {
  const brands = await getAllBrands();
  return brands.map((b) => ({ slug: b.slug }));
}

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await getBrandBySlug(params.slug);
  if (!brand) return {};
  const title = `${brand.name} tesztek – termékbemutatók és értékelések magyarul`;
  const description = `Az összes ${brand.name} termékteszt egy helyen: részletes bemutatók, vásárlói vélemények összesítése, pontozás és vásárlási tippek.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/marka/${brand.slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/marka/${brand.slug}`) },
  };
}

export default async function BrandPage({ params }: Props) {
  const brand = await getBrandBySlug(params.slug);
  if (!brand) notFound();

  const posts = await getBrandPosts(brand.name, 12);

  const crumbs = [{ name: 'Kezdőlap', href: '/' }, { name: `${brand.name} tesztek` }];

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${brand.name} tesztek`,
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.href || `/marka/${brand.slug}` })))
          ),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <Breadcrumbs items={crumbs} />

      <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-wide text-teal-600">
        Márka · {brand.count} teszt
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        {brand.name} tesztek
      </h1>
      <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-ink/70">
        Az összes {brand.name} termékről készült magyar nyelvű tesztünk egy helyen, pontszám
        szerint rendezve: részletes bemutatók, vásárlói vélemények összesítése, előnyök és
        hátrányok. Ha {brand.name} terméket keresel, itt megtalálod, melyik éri meg a legjobban.
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 font-body text-ink/60">Ebben a márkában még nincs publikált teszt.</p>
      ) : (
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
                    <span className="font-display text-lg font-bold text-ink">{i + 1}.</span>
                    {p.rating != null && <RatingBadge rating={p.rating} size="sm" />}
                    {p.priceFt != null && formatPriceFt(p.priceFt) && (
                      <span className="font-sans text-sm text-ink/55">{formatPriceFt(p.priceFt)}</span>
                    )}
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
      )}
    </article>
  );
}
