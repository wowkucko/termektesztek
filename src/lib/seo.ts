import type { PostWithRelations } from '@/lib/data';
import { readingTimeMinutes } from '@/lib/utils';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Terméktesztek és vélemények';
export const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Alapos, független terméktesztek és vásárlási tanácsok.';

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export function postJsonLd(
  post: PostWithRelations,
  extras?: { commentCount?: number; commentAvg?: number | null }
) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  const image = absoluteUrl(post.ogImage || post.coverImage || '/og-default.png');

  const base = {
    '@context': 'https://schema.org',
    headline: post.title,
    description: post.excerpt,
    image: [image],
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    inLanguage: 'hu-HU',
    keywords: post.tags.map((t) => t.tag.name).join(', '),
    articleSection: post.category.name,
    wordCount: post.content.trim().split(/\s+/).filter(Boolean).length,
    timeRequired: `PT${readingTimeMinutes(post.content)}M`,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.png') },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  // Ha van értékelés, Review séma a terméktípussal - ez teszi lehetővé a csillagos
  // értékelés megjelenését a Google keresési találatokban. A BlogPosting típus (ami
  // maga is Article altípus) a Review-vel kombinálva jelzi, hogy az oldal egyszerre
  // blogbejegyzés és termékértékelés.
  if (post.rating != null && post.productName) {
    const hasPrice = typeof post.priceFt === 'number' && post.priceFt > 0;
    const commentCount = extras?.commentCount ?? 0;
    return {
      ...base,
      '@type': ['Review', 'BlogPosting'],
      itemReviewed: {
        '@type': 'Product',
        name: post.productName,
        brand: post.productBrand ? { '@type': 'Brand', name: post.productBrand } : undefined,
        image,
        // Olvasói csillagok összesítve (csak ha van legalább 1 csillagos komment)
        ...(commentCount > 0 && extras?.commentAvg != null
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Math.round(extras.commentAvg * 10) / 10,
                bestRating: 5,
                worstRating: 1,
                ratingCount: commentCount,
              },
            }
          : {}),
        // Aktuális ár a találati megjelenéshez (csak ha ismert)
        ...(hasPrice
          ? {
              offers: {
                '@type': 'Offer',
                priceCurrency: 'HUF',
                price: post.priceFt,
                availability: 'https://schema.org/InStock',
                url,
              },
            }
          : {}),
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: post.rating,
        bestRating: 10,
        worstRating: 0,
      },
    };
  }

  // BlogPosting az Article egy altípusa; a két típus együtt expliciten jelzi a
  // Google-nek, hogy cikk jellegű tartalomról van szó.
  return { ...base, '@type': ['BlogPosting', 'Article'] };
}

export function faqJsonLd(post: PostWithRelations): object | null {
  // A FAQ kérdéseit az oldalon látható előnyök/hátrányok listából építjük fel -
  // a Google elvárása, hogy a kérdések és válaszok megjelenjenek a lapon.
  const subject = post.productName || post.title;
  const joinList = (items: string[]) =>
    items
      .map((s) => s.trim().replace(/[.;,]+$/, ''))
      .join('. ') + '.';

  const questions: Array<{ name: string; text: string }> = [];
  if (post.pros.length > 0) {
    questions.push({
      name: `Melyek a(z) ${subject} főbb előnyei?`,
      text: joinList(post.pros),
    });
  }
  if (post.cons.length > 0) {
    questions.push({
      name: `Melyek a(z) ${subject} főbb hátrányai?`,
      text: joinList(post.cons),
    });
  }

  if (questions.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(({ name, text }) => ({
      '@type': 'Question',
      name,
      acceptedAnswer: { '@type': 'Answer', text },
    })),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/kereses?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/logo.png'),
  };
}
