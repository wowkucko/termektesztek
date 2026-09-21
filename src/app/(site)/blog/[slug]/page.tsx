import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';import { getPostBySlug, getPublishedPostSlugs, getRelatedPosts, getRelevantPosts, getPostComments, getCommentStats, getRankablePosts } from '@/lib/data';
import { SITE_NAME, absoluteUrl, breadcrumbJsonLd, faqJsonLd, postJsonLd } from '@/lib/seo';
import { formatDate, formatPriceFt, readingTimeMinutes, slugify, truncate } from '@/lib/utils';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import { RatingBadge } from '@/components/site/VerdictStamp';
import ProsConsBox from '@/components/site/ProsConsBox';
import ShareButtons from '@/components/site/ShareButtons';
import PostCard from '@/components/site/PostCard';
import MarkdownImage from '@/components/site/MarkdownImage';
import CommentSection from '@/components/site/CommentSection';
import AdSlot from '@/components/site/AdSlot';
import AgeGate from '@/components/site/AgeGate';
import ProductClassLinks from '@/components/site/ProductClassLinks';
import CompareTable from '@/components/site/CompareTable';
import { findCompareMatches } from '@/lib/compare';
import { slots } from '@/lib/ads';
import { ADULT_CONSENT_COOKIE, hasAdultConsent, isAdultContent } from '@/lib/adultContent';
import { productClassesForPost } from '@/lib/productClasses';
import { isValidElement, type ReactNode } from 'react';

export const revalidate = 3600;

// A publilált cikkek statikus HTML-ként épülnek be (gyors első betöltés,
// Googlebot-barát); az új/egyéb slugok ISR-rel, igény szerint renderelődnek.
export async function generateStaticParams() {
  const slugs = await getPublishedPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

type Props = { params: { slug: string } };

// Tartalomjegyzék + fejléc-anchorok: a markdown ## címsorokból építkezünk,
// a lenti h2-renderer UGYANAZZAL a slugify-jal ad id-t a fejléceknek, így a
// TOC-linkek mindig célba találnak.
function headingTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(headingTextContent).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return headingTextContent(node.props.children);
  return '';
}

function buildToc(content: string): { text: string; id: string }[] {
  const out: { text: string; id: string }[] = [];
  for (const m of content.matchAll(/^##\s+(.+?)\s*$/gm)) {
    const text = m[1].replace(/[*_`~[\]()]/g, '').trim();
    if (!text) continue;
    const id = slugify(text);
    if (!id || out.some((t) => t.id === id)) continue;
    out.push({ text, id });
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || truncate(post.excerpt, 160);

  // Megosztási kép: alapból a cikkhez renderelt dinamikus OG-kártya
  // (/blog/{slug}/og — cím, termék, pontszám); ha az admin explicit ogImage-et adott
  // meg, az nyer. Stabil URL, ezért explicit images-szel adjuk meg.
  const ogImageUrl = absoluteUrl(post.ogImage || `/blog/${post.slug}/og`);

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/blog/${post.slug}`) },
    // 18+ cikkek jelölése a metaadatokban is (keresők, szűrők, szülői eszközök)
    ...(isAdultContent(post) ? { other: { rating: 'adult' } } : {}),
    openGraph: {
      type: 'article',
      title,
      description,
      url: absoluteUrl(`/blog/${post.slug}`),
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await getPostBySlug(params.slug);
  if (!post || post.status !== 'PUBLISHED') notFound();

  // 18+ (szexuális jellegű) cikkek: a tartalom addig NEM renderelődik, amíg a
  // látogató nem erősítette meg a korhatárt. A kaput szerveroldalon döntjük el,
  // így a szöveg a hozzájárulás előtt a HTML-be sem kerül bele.
  // A cookies() hívás csak ezeknél a cikkeknél fut le, ezért a többi cikk
  // továbbra is statikus HTML-ként szolgálódik ki.
  if (isAdultContent(post)) {
    const verified = hasAdultConsent((await cookies()).get(ADULT_CONSENT_COOKIE)?.value);
    if (!verified) {
      const adultCrumbs = [
        { name: 'Kezdőlap', href: '/' },
        { name: post.category.name, href: `/kategoria/${post.category.slug}` },
        { name: '18+ felnőtt tartalom' },
      ];
      return (
        <div className="pb-20">
          <div className="container-page pt-8">
            <Breadcrumbs items={adultCrumbs} />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  breadcrumbJsonLd(
                    adultCrumbs.map((c) => ({ name: c.name, path: c.href || `/blog/${post.slug}` }))
                  )
                ),
              }}
            />
          </div>
          <AgeGate />
        </div>
      );
    }
  }

  const related = await getRelatedPosts(post);
  const relevant = await getRelevantPosts(post, 5);
  const minutes = readingTimeMinutes(post.content);
  const [comments, commentStats, rankable] = await Promise.all([
    getPostComments(post.id),
    getCommentStats(post.id),
    // Az összehasonlító párokhoz: minden publikált cikk (cache-elt kérésenként)
    getRankablePosts(),
  ]);

  // Összehasonlító táblázat: csak azonos termékosztályú, valóban hasonló
  // termékekkel (lásd src/lib/compare.ts — hard guard + pontozási küszöb).
  const compareMatches = findCompareMatches(post, rankable, 2);

  const crumbs = [
    { name: 'Kezdőlap', href: '/' },
    { name: post.category.name, href: `/kategoria/${post.category.slug}` },
    { name: post.title },
  ];

  const faq = faqJsonLd(post);

  // Tartalomjegyzék a ## címsorokból (2+ címsor esetén mutatjuk)
  const toc = buildToc(post.content);

  // Látható GYIK az előnyök/hátrányok listából - ugyanaz a tartalom, mint a
  // FAQPage JSON-LD sémában (a Google ezt várja el a rich resultokhoz).
  const faqSubject = post.productName || post.title;
  const faqJoin = (items: string[]) => items.map((s) => s.trim().replace(/[.;,]+$/, '')).join('. ') + '.';
  const faqQa: { q: string; a: string }[] = [];
  if (post.pros.length > 0) faqQa.push({ q: `Melyek a(z) ${faqSubject} főbb előnyei?`, a: faqJoin(post.pros) });
  if (post.cons.length > 0) faqQa.push({ q: `Melyek a(z) ${faqSubject} főbb hátrányai?`, a: faqJoin(post.cons) });

  // "Frissítve" jelzés: csak akkor, ha a tartalom ténylegesen módosult a
  // publikálás után (a views-számláló már nem bántja az updatedAt-ot).
  const showUpdated =
    !!post.publishedAt && post.updatedAt.getTime() - post.publishedAt.getTime() > 24 * 3600 * 1000;

  // Termékosztály-toplisták ehhez a cikkhez (pl. "legjobb air fryer"): a
  // "legjobb X" hubok a legkeresettebb oldalak, ezért minden cikkből linkeljük
  // őket - a látogató is itt látja, mihez hasonlítható a tesztelt termék.
  const classLinks = productClassesForPost(post, 3).map((c) => ({
    href: `/legjobb/${c.slug}`,
    label: `Legjobb ${c.name} – toplista`,
  }));

  // Aktuális ár a termékdobozokba (a szinkron menti; tájékoztató jellegű)
  const priceLabel = formatPriceFt(post.priceFt);
  const brandSlug = post.productBrand ? slugify(post.productBrand) : null;

  // Megtekintésszámláló inline scriptként: a cikkoldalnak így NINCS saját
  // kliens komponense (nincs hidratáció-igénye), a view-mérés sima fetch.
  const viewScript = `fetch('/api/post-views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:${JSON.stringify(post.id)}})}).catch(()=>{})`;

  // Affiliate kattintás-mérés: a cikk MINDEN affiliate linkjére (termékdoboz +
  // oldalsáv — egynek számít) kattintás-figyelő megy. sendBeacon: navigációkor
  // is elküldi a jelet, nem blokkolja a távoást; body-ként a cikk id megy,
  // a text/plain az egyetlen Content-Type, amit a sendBeacon garantáltan elfogad.
  const affiliateClickScript = `(function(){try{document.querySelectorAll('[data-affiliate-id]').forEach(function(el){el.addEventListener('click',function(){if(navigator.sendBeacon){navigator.sendBeacon('/api/post-affiliate-click',new Blob([JSON.stringify({id:${JSON.stringify(post.id)}})],{type:'text/plain'}));}});});}catch(e){}})()`;

  return (
    <article className="pb-20">
      <script async dangerouslySetInnerHTML={{ __html: viewScript }} />
      <script async dangerouslySetInnerHTML={{ __html: affiliateClickScript }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(postJsonLd(post, { commentCount: commentStats.count, commentAvg: commentStats.avg })),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.href || `/blog/${post.slug}` })))
          ),
        }}
      />
      {faq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      )}

      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} />

        <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
          {post.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-sm text-ink/65">
          {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
          {showUpdated && post.publishedAt && (
            <>
              <span aria-hidden="true">·</span>
              <span>Frissítve: {formatDate(post.updatedAt)}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{minutes} perces olvasás</span>
          <span aria-hidden="true">·</span>
          <Link href={`/kategoria/${post.category.slug}`} className="font-medium text-teal-600">
            {post.category.name}
          </Link>
          {post.rating != null && (
            <span className="ml-auto">
              <RatingBadge rating={post.rating} size="sm" />
            </span>
          )}
        </div>
      </div>

      <div className="container-page mt-8">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-card bg-teal-50">
          {post.coverImage && (
            <Image
              src={post.coverImage}
              alt={post.coverImageAlt || post.title}
              fill
              priority
              sizes="(min-width: 1024px) 900px, 88vw"
              className="object-cover"
            />
          )}
        </div>
      </div>

      <div className="container-page mt-16 grid gap-10 lg:grid-cols-[1fr,280px]">
        {/* min-w-0: grid-elemként különben a min-w-[640px] compare-tábla széthúzná a layoutot mobilon */}
        <div className="post-content min-w-0">
          {(post.productName || post.affiliateUrl) && (
            <div className="not-prose mb-8 rounded-card border border-line bg-teal-50/50 p-5">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">
                Tesztelt termék
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">
                {[post.productBrand, post.productName].filter(Boolean).join(' — ') || post.productName}
              </p>
              {priceLabel && (
                <p className="mt-2 font-sans text-sm text-ink/65">
                  Aktuális ár: <span className="font-bold text-ink">{priceLabel}</span>{' '}
                  <span className="text-xs">(tájékoztató jellegű)</span>
                </p>
              )}
              {post.affiliateUrl && (
                <a
                  href={post.affiliateUrl}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  data-affiliate-id={post.id}
                  className="btn-primary mt-4"
                >
                  Termék megvásárlása
                </a>
              )}
            </div>
          )}

          <ProductClassLinks
            className="mb-8"
            heading="A kategória legjobbjai"
            intro="Hasonlítsd össze a kategória legjobbra értékelt modelljeit ársáv szerint is:"
            links={classLinks}
          />

          <AdSlot slot={slots().article} label="Cikk eleji hirdetés" />

          {toc.length >= 2 && (
            <nav aria-label="Tartalomjegyzék" className="not-prose mb-8 rounded-card border border-line bg-white p-5">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/65">
                A cikk tartalma
              </p>
              <ul className="mt-3 space-y-1.5">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="font-sans text-sm text-teal-700 hover:underline">
                      {t.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              img: MarkdownImage,
              h2: ({ children }) => {
                const id = slugify(headingTextContent(children));
                return (
                  <h2 id={id || undefined} className="scroll-mt-28">
                    {children}
                  </h2>
                );
              },
            }}
          >
            {post.content}
          </ReactMarkdown>

          <ProsConsBox pros={post.pros} cons={post.cons} />

          {post.verdict && (
            <div className="not-prose my-8 rounded-card border-l-4 border-teal-500 bg-white p-6 shadow-card">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">
                Végső verdikt
              </p>
              <p className="mt-2 font-body text-lg leading-relaxed text-ink">{post.verdict}</p>
            </div>
          )}

          {/* Az összehasonlítás a verdikt után: előbb a döntés, aztán a párharc */}
          <CompareTable current={post} matches={compareMatches} />

          {faqQa.length > 0 && (
            <section aria-label="Gyakori kérdések" className="not-prose my-8">
              <h2 id="gyik" className="scroll-mt-28 font-display text-xl font-bold text-ink">
                Gyakori kérdések
              </h2>
              <div className="mt-4 space-y-3">
                {faqQa.map((item) => (
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

          <div className="not-prose my-8 rounded-card border border-line bg-teal-50/50 p-5">
            <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">
              A szerzőről
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed text-ink/75">
              A cikket a <strong>{SITE_NAME}</strong> szerkesztősége készítette nyilvános
              termékadatok és vásárlói vélemények alapján. Tesztelési módszerünkről és a
              csapatról bővebben: <Link href="/rolunk" className="font-medium text-teal-700 hover:underline">Rólunk</Link>.
            </p>
          </div>

          <AdSlot slot={slots().article} label="Cikk végi hirdetés" />

          <CommentSection
            postId={post.id}
            slug={post.slug}
            initial={comments.map((c) => ({
              id: c.id,
              author: c.author,
              rating: c.rating,
              text: c.text,
              createdAt: c.createdAt.toISOString(),
            }))}
            avg={commentStats}
          />

          <div className="not-prose mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <div className="flex flex-wrap gap-2">
              {post.tags.map(({ tag }) => (
                <Link
                  key={tag.id}
                  href={`/cimke/${tag.slug}`}
                  className="rounded-chip border border-ink/15 px-3 py-1 font-sans text-xs text-ink/65 hover:border-teal-500 hover:text-teal-600"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
            <ShareButtons url={absoluteUrl(`/blog/${post.slug}`)} title={post.title} />
          </div>
        </div>

        <aside className="lg:pt-2">
          <div className="sticky top-24 space-y-5">
            {(post.productName || post.affiliateUrl) && (
              <div className="rounded-card border border-line bg-teal-50/50 p-5">
                <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Tesztelt termék
                </p>
                <p className="mt-1 font-display text-base font-semibold leading-snug text-ink">
                  {[post.productBrand, post.productName].filter(Boolean).join(' — ') || post.productName}
                </p>
                {brandSlug && post.productBrand && (
                  <p className="mt-1 font-sans text-xs">
                    <Link href={`/marka/${brandSlug}`} className="text-teal-600 hover:underline">
                      További {post.productBrand} tesztek →
                    </Link>
                  </p>
                )}
                {priceLabel && (
                  <p className="mt-2 font-sans text-sm text-ink/65">
                    Aktuális ár: <span className="font-bold text-ink">{priceLabel}</span>
                  </p>
                )}
                {post.rating != null && (
                  <p className="mt-2 font-sans text-sm font-semibold text-teal-700">
                    {post.rating.toFixed(1)}/10 pont
                  </p>
                )}
                {post.affiliateUrl && (
                  <>
                    <p className="mt-3 rounded-tight bg-signal/10 px-3 py-2 font-sans text-sm font-semibold leading-snug text-signal-700">
                      Szerintünk a legjobb ajánlatot a termék megvásárlására a lenti gombon találod!
                    </p>
                    <a
                      href={post.affiliateUrl}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      data-affiliate-id={post.id}
                      className="btn-primary mt-3"
                    >
                      Termék megvásárlása
                    </a>
                  </>
                )}
              </div>
            )}

            <div className="rounded-card border border-line bg-white p-5">
              <ShareButtons url={absoluteUrl(`/blog/${post.slug}`)} title={post.title} />
            </div>

            <AdSlot slot={slots().sidebar} label="Oldalsáv hirdetés" />

            {relevant.length > 0 && (
              <div className="rounded-card border border-line bg-white p-5">
                <p className="font-sans text-xs font-semibold uppercase tracking-wide text-ink/65">
                  Kapcsolódó tesztek
                </p>
                <ul className="mt-3 space-y-3">
                  {relevant.map((p) => (
                    <li key={p.id}>
                      <Link href={`/blog/${p.slug}`} className="group block">
                        <p className="font-sans text-sm font-medium leading-snug text-ink transition-colors group-hover:text-teal-600">
                          {p.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 font-sans text-xs text-ink/65">
                          {p.category.name}
                          {p.rating != null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-teal-700">{p.rating.toFixed(1)}/10</span>
                            </>
                          )}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-page mt-20">
          <h2 className="mb-6 font-display text-2xl font-bold text-ink">Hasonló tesztek a kategóriában</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
