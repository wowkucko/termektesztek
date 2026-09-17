import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  getAllCategories,
  getCategoryBySlug,
  getRankablePosts,
  getTopRatedPosts,
  type RankablePost,
} from '@/lib/data';
import { absoluteUrl, breadcrumbJsonLd, faqJsonLdFromItems, listingRobots } from '@/lib/seo';
import { formatPriceFt } from '@/lib/utils';
import {
  PRODUCT_CLASSES,
  MIN_POSTS_FOR_PRODUCT_CLASS,
  countProductClassPosts,
  getProductClass,
  priceBandsFor,
  productClassesForCategory,
  rankProductClassPosts,
  type PriceBand,
  type ProductClass,
} from '@/lib/productClasses';
import { productClassContent, type ProductClassContent } from '@/lib/productClassContent';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import ProductClassLinks from '@/components/site/ProductClassLinks';
import { RatingBadge } from '@/components/site/VerdictStamp';

export const revalidate = 3600;

type Props = { params: { slug: string }; searchParams: { maxAr?: string } };

const TOP_N = 10;

/**
 * A /legjobb/{slug} kétfajta rangsort szolgál ki ugyanazzal a megjelenéssel:
 *  - termékosztály (pl. /legjobb/air-fryer) - ez a keresett szándék, kulcsszó-alapú
 *    besorolással, kategóriától függetlenül (lásd src/lib/productClasses.ts);
 *  - kategória (pl. /legjobb/otthon-es-konyha) - a szélesebb gyűjtőoldal.
 * A termékosztály slugja elsőbbséget élvez, ütközés nincs (ellenőrizve a teszttel).
 */
export async function generateStaticParams() {
  const categories = await getAllCategories();
  return [
    ...PRODUCT_CLASSES.map((c) => ({ slug: c.slug })),
    ...categories.map((c) => ({ slug: c.slug })),
  ];
}

type ToplistSource = {
  kind: 'class' | 'category';
  /** Kereshető alak (kisbetűs): "air fryer", "otthon és konyha". */
  name: string;
  h1: string;
  intro: string;
  eyebrow: string;
  categoryName: string | null;
  categorySlug: string | null;
  crumbs: { name: string; href?: string }[];
  posts: RankablePost[];
  bands: PriceBand[];
  /** Szerkesztői tartalom (vásárlási tanácsok, szempontok, GYIK) - csak osztályoknál. */
  content: ProductClassContent | null;
  /** Az árszűrés előtti összes cikk (a vékony-tartalom döntéshez és a szöveghez). */
  totalCount: number;
  canonicalPath: string;
  metaTitle: string;
  metaDescription: string;
};

// React cache(): a generateMetadata és az oldal ugyanebben a kérésben fut, így
// a drága (670 cikkes) besorolás egyszer történik meg.
const resolveSource = cache(async (slug: string, maxAr: number | null): Promise<ToplistSource | null> => {
  const year = new Date().getFullYear();

  const cls = getProductClass(slug);
  if (cls) {
    const all = await getRankablePosts();
    const rankedAll = rankProductClassPosts(all, cls, null, Number.MAX_SAFE_INTEGER);
    const posts = maxAr == null ? rankedAll.slice(0, TOP_N) : rankProductClassPosts(all, cls, maxAr, TOP_N);
    const category = await getCategoryBySlug(cls.categorySlug);
    const categoryName = category?.name ?? null;
    const crumbs = [
      { name: 'Kezdőlap', href: '/' },
      ...(categoryName ? [{ name: categoryName, href: `/kategoria/${cls.categorySlug}` }] : []),
      { name: `Legjobb ${cls.name} ${year}` },
    ];
    return {
      kind: 'class',
      name: cls.name,
      h1: `Legjobb ${cls.name} ${year}: rangsor és összehasonlítás`,
      intro: cls.blurb,
      eyebrow: `🏆 ${categoryName ?? 'Toplista'} · ${year}`,
      categoryName,
      categorySlug: categoryName ? cls.categorySlug : null,
      crumbs,
      posts,
      bands: priceBandsFor(cls),
      content: productClassContent(cls.slug),
      totalCount: rankedAll.length,
      canonicalPath: `/legjobb/${cls.slug}`,
      metaTitle: `Legjobb ${cls.name} ${year} – toplista és összehasonlítás`,
      metaDescription: `${cls.blurb} Rangsor ${rankedAll.length} magyar nyelvű teszt pontszámai alapján, ársáv szerint is szűrhető, összehasonlító táblázattal.`,
    };
  }

  const category = await getCategoryBySlug(slug);
  if (!category) return null;

  const catName = category.name.toLowerCase();
  const posts = await getTopRatedPosts(category.slug, TOP_N, maxAr);
  // A kategória publikált cikkszáma a vékony-tartalom döntéshez (a toplista
  // csak 10 elemet mutat, de az oldal a teljes kategóriát képviseli).
  const allCategories = await getAllCategories();
  const totalCount = allCategories.find((c) => c.slug === category.slug)?._count.posts ?? posts.length;

  return {
    kind: 'category',
    name: catName,
    h1: `Legjobb ${catName} ${year}: rangsor és összehasonlítás`,
    intro:
      category.description ||
      `Összegyűjtöttük a legjobbra értékelt ${catName} termékeket az oldalon megjelent magyar nyelvű tesztek alapján. A sorrendet a tesztjeinkben adott pontszámok határozzák meg, így egy pillantással láthatod, melyikkel járhatsz a legjobban.`,
    eyebrow: `🏆 Toplista · ${year}`,
    categoryName: category.name,
    categorySlug: category.slug,
    crumbs: [
      { name: 'Kezdőlap', href: '/' },
      { name: category.name, href: `/kategoria/${category.slug}` },
      { name: `Legjobb ${catName} ${year}` },
    ],
    posts,
    bands: [
      { label: 'Mind', value: null },
      { label: '50 ezer Ft alatt', value: 50000 },
      { label: '100 ezer Ft alatt', value: 100000 },
      { label: '200 ezer Ft alatt', value: 200000 },
    ],
    content: null,
    totalCount,
    canonicalPath: `/legjobb/${category.slug}`,
    metaTitle: `Legjobb ${catName} ${year} – toplista és összehasonlítás`,
    metaDescription: `A legjobbra értékelt ${catName} termékek rangsorolva, magyar nyelvű tesztek alapján. Összehasonlító táblázat pontszámokkal, előnyökkel és vásárlási linkekkel.`,
  };
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const maxAr = Number(searchParams.maxAr) || null;
  const source = await resolveSource(params.slug, maxAr);
  if (!source) return {};

  const band = source.bands.find((b) => b.value === maxAr);
  const title = band?.value ? `${source.metaTitle.split(' – ')[0]} – ${band.label.toLowerCase()} – toplista` : source.metaTitle;
  const description = band?.value ? source.metaDescription.replace('Rangsor', `${band.label} szűrve. Rangsor`) : source.metaDescription;

  return {
    title,
    description,
    // Az ársávos nézet ugyanannak a tartalomnak a szűrt változata: a canonical
    // mindig az alap URL-re mutat. A vékony (<3 cikkes) osztályok noindexet kapnak.
    robots: listingRobots(source.totalCount),
    alternates: { canonical: absoluteUrl(source.canonicalPath) },
    openGraph: { title, description, url: absoluteUrl(source.canonicalPath) },
  };
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default async function ToplistPage({ params, searchParams }: Props) {
  const maxAr = Number(searchParams.maxAr) || null;
  const source = await resolveSource(params.slug, maxAr);
  if (!source) notFound();

  const { posts: top, bands, name } = source;
  const year = new Date().getFullYear();
  const activeBand = bands.find((b) => (b.value ?? null) === maxAr) ?? bands[0];
  const hasPrices = top.some((p) => p.priceFt != null);

  // Testvérosztályok ugyanabban a kategóriában (belső linkelés mindkét irányban).
  const siblingLinks: { href: string; label: string }[] = [];
  if (source.categorySlug) {
    const all = await getRankablePosts();
    const siblings = productClassesForCategory(source.categorySlug).filter(
      (c: ProductClass) => c.slug !== params.slug
    );
    for (const c of siblings) {
      const count = countProductClassPosts(all, c);
      if (count < MIN_POSTS_FOR_PRODUCT_CLASS) continue;
      siblingLinks.push({ href: `/legjobb/${c.slug}`, label: `Legjobb ${c.name} (${count})` });
    }
    if (source.kind === 'class') {
      siblingLinks.push({
        href: `/legjobb/${source.categorySlug}`,
        label: `Legjobb ${source.categoryName?.toLowerCase()} – teljes toplista`,
      });
    }
  }

  const faqJsonLd = faqJsonLdFromItems(source.content?.faq ?? []);

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: source.h1,
    description: source.metaDescription,
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
            breadcrumbJsonLd(source.crumbs.map((c) => ({ name: c.name, path: c.href || source.canonicalPath })))
          ),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}

      <Breadcrumbs items={source.crumbs} />

      <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-wide text-signal-700">
        {source.eyebrow}
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        {source.h1}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-sm text-ink/65">
        <span>
          <strong className="font-semibold text-ink">{source.totalCount}</strong> teszt pontszámai alapján
        </span>
        {source.categorySlug && source.categoryName && (
          <>
            <span aria-hidden="true">·</span>
            <Link href={`/kategoria/${source.categorySlug}`} className="font-medium text-teal-600 hover:underline">
              Összes {source.categoryName.toLowerCase()} teszt
            </Link>
          </>
        )}
      </div>

      <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-ink/70">
        {source.intro} Mindegyikhez részletes tesztet is találsz előnyökkel, hátrányokkal és vásárlói
        vélemények összesítésével.
      </p>

      {hasPrices && bands.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {bands.map((b) => {
            const isActive = (b.value ?? null) === (activeBand.value ?? null);
            const href = b.value == null ? source.canonicalPath : `${source.canonicalPath}?maxAr=${b.value}`;
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

      {/* Szerkesztői tartalom: a rangsor előtt, hogy a látogató (és a kereső)
          a döntéshez szükséges szempontokat is lássa, ne csak a listát. */}
      {source.content && (
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="vasarlasi-tanacsok">
            <h2 id="vasarlasi-tanacsok" className="font-display text-2xl font-bold text-ink">
              Mire figyelj {name} vásárlásnál?
            </h2>
            <ul className="mt-4 space-y-4">
              {source.content.tips.map((tip) => (
                <li key={tip.title} className="rounded-card border border-line bg-white p-5">
                  <p className="font-display text-base font-semibold text-ink">{tip.title}</p>
                  <p className="mt-1.5 font-body text-sm leading-relaxed text-ink/70">{tip.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="rangsorolas-szempontjai">
            <h2 id="rangsorolas-szempontjai" className="font-display text-2xl font-bold text-ink">
              Mik alapján rangsoroltunk?
            </h2>
            <ul className="mt-4 space-y-4">
              {source.content.criteria.map((c) => (
                <li key={c.title} className="flex gap-3">
                  <span aria-hidden="true" className="mt-0.5 font-display text-lg font-bold text-teal-600">
                    ✓
                  </span>
                  <span>
                    <span className="block font-display text-base font-semibold text-ink">{c.title}</span>
                    <span className="mt-1 block font-body text-sm leading-relaxed text-ink/70">{c.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-sans text-xs leading-relaxed text-ink/60">
              A pontszámok a blogon megjelent tesztek értékelései. Részletek:{' '}
              <Link href="/rolunk" className="font-medium text-teal-700 hover:underline">
                tesztelési módszerünk
              </Link>
              .
            </p>
          </section>
        </div>
      )}

      {top.length === 0 ? (
        <p className="mt-10 font-body text-ink/65">
          {maxAr != null ? (
            <>
              Ebben az ársávban nincs értékelt teszt.{' '}
              <Link href={source.canonicalPath} className="font-medium text-teal-600 hover:underline">
                Nézd meg az összes {name} tesztet
              </Link>
              .
            </>
          ) : (
            <>
              Ehhez a listához még nincs értékelt teszt.{' '}
              {source.categorySlug && (
                <Link href={`/kategoria/${source.categorySlug}`} className="font-medium text-teal-600 hover:underline">
                  Böngészd a kategóriát
                </Link>
              )}
            </>
          )}
        </p>
      ) : (
        <>
          <h2 className="mt-12 font-display text-2xl font-bold text-ink">Összehasonlító táblázat</h2>
          <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/65">
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
                      <span className="font-display text-lg font-bold text-ink">{MEDALS[i] || `${i + 1}.`}</span>
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

      {/* GYIK: a látható kérdések és a FAQPage séma ugyanebből a listából épül */}
      {source.content && source.content.faq.length > 0 && (
        <section aria-labelledby="gyik" className="mt-14">
          <h2 id="gyik" className="font-display text-2xl font-bold text-ink">
            Gyakori kérdések a(z) {name} választásához
          </h2>
          <div className="mt-4 space-y-3">
            {source.content.faq.map((item) => (
              <details key={item.q} className="rounded-card border border-line bg-white p-4">
                <summary className="cursor-pointer font-sans text-sm font-semibold text-ink">
                  {item.q}
                </summary>
                <p className="mt-2 font-body text-sm leading-relaxed text-ink/75">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Belső linkek: testvérosztályok és a kategória teljes toplistája */}
      {siblingLinks.length > 0 && (
        <ProductClassLinks
          className="mt-14"
          heading={
            source.kind === 'class'
              ? 'További toplisták ugyanebben a kategóriában'
              : 'Termékosztály-toplisták ebben a kategóriában'
          }
          links={siblingLinks}
        />
      )}
    </article>
  );
}
