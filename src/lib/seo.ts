import type { Metadata } from 'next';
import type { PostWithRelations } from '@/lib/data';
import { readingTimeMinutes } from '@/lib/utils';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Terméktesztek és vélemények';
export const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Alapos, független terméktesztek és vásárlási tanácsok.';

/**
 * Alapértelmezett megosztási (og:image / twitter:image) kép. Ez az egyetlen hely,
 * ahol a fájlnév szerepel - a cikkek metaadat-összeállítója is ezt importálja.
 */
export const DEFAULT_OG_IMAGE = '/og-default.png';

/**
 * A Next.js metadata shallow merge-t használ: ha egy oldal SAJÁT openGraph-ot
 * ad meg, az teljes egészében felülírja a layoutét - így az og:image (és a
 * többi layout-szintű OG mező) leesik róla. Ezért minden oldal, ami saját
 * openGraph-ot definiál, explicit images-t is kap: ezzel a segéddel.
 *
 * A twitter meta NEM shallow merge-lődik, ha nincs saját twitter blokk: ilyenkor
 * a Next.js a megoldott openGraph-ból vezeti le (lásd resolve-metadata.js,
 * file-based metadata fallback). Tehát twittert elég a layoutban tartani.
 */
export function defaultOgImages(alt?: string) {
  return [
    {
      url: absoluteUrl(DEFAULT_OG_IMAGE),
      width: 1200,
      height: 630,
      ...(alt ? { alt } : {}),
    },
  ];
}

/**
 * A layout OG-alapját (type/locale/siteName) minden, saját openGraph-ot adó
 * oldalra ráteszi — a Next shallow merge-je miatt ezek a mezők különben
 * leesnének. Minden oldal innen kapja az openGraph objektumot.
 */
export function baseOpenGraph(input: {
  title: string;
  description?: string;
  url: string;
  type?: 'website' | 'article';
  images: NonNullable<Metadata['openGraph']>['images'];
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string | string[];
  tags?: string[];
}): Metadata['openGraph'] {
  return {
    type: input.type ?? 'website',
    locale: 'hu_HU',
    siteName: SITE_NAME,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    images: input.images,
    ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
    ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    ...(input.authors ? { authors: input.authors } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
  } as Metadata['openGraph'];
}

/**
 * Szerző személy (Person séma) — az Article/Review `author` mezőjében és a
 * látható „A szerzőről" doboz mellé. A tartalom társaságként készül, de a
 * Google E-E-A-T jeleihez Person típusú szerzőt vár (Organization szerző
 * önmagában nem elég a cikkoldalaknál).
 */
export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: `${SITE_NAME} szerkesztősége`,
    url: absoluteUrl('/rolunk'),
    worksFor: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };
}

/**
 * ItemList séma egy listaoldalhoz (kategória, címke): a látható kártyák
 * sorrendjét adja vissza. Csak indexelhető oldalon érdemes megjeleníteni.
 */
export function itemListJsonLd(
  name: string,
  items: Array<{ slug: string; title: string; productName?: string | null }>,
  description?: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    ...(description ? { description } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/blog/${p.slug}`),
      name: p.productName || p.title,
    })),
  };
}

/**
 * Ennyi publikált cikk alatt egy listaoldal (címke, márka, kategória) a Google
 * szemében vékony/duplikált tartalom: ilyenkor nem indexeljük, de a benne lévő
 * linkeket követjük - így a crawler továbbra is eljut az ott szereplő cikkekhez.
 * Ugyanez a küszöb szűri a sitemapet is (lásd src/app/sitemap.ts).
 */
export const MIN_POSTS_FOR_LISTING_INDEX = 3;

/**
 * robots meta egy listaoldalhoz: a 2. és további lapozott oldalak mindig
 * noindexek (duplikált tartalom), és a küszöb alatti cikkszámú listák is.
 * Az `undefined` azt jelenti, hogy az oldal alapból indexelhető.
 */
export function listingRobots(postCount: number, page = 1): Metadata['robots'] {
  if (postCount < MIN_POSTS_FOR_LISTING_INDEX || page > 1) {
    return { index: false, follow: true };
  }
  return undefined;
}

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
    author: personJsonLd(),
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
        // A látható pontszám 0–10-es skálán van, de az aggregateRating (olvasói
        // csillagok) 1–5-ös: a két séma-skálának EGYEZNIE kell, különben a
        // Google manuális beavatkozást kezdeményezhet. Egységesen 1–5.
        ratingValue: Math.min(5, Math.max(1, Math.round(post.rating * 5) / 10)),
        bestRating: 5,
        worstRating: 1,
      },
    };
  }

  // BlogPosting az Article egy altípusa; a két típus együtt expliciten jelzi a
  // Google-nek, hogy cikk jellegű tartalomról van szó.
  return { ...base, '@type': ['BlogPosting', 'Article'] };
}

/**
 * FAQPage séma kérdés-válasz párokból (a termékosztály-toplisták GYIK-jéhez).
 * A Google elvárása szerint ugyanaz a szöveg látható is az oldalon.
 */
export function faqJsonLdFromItems(items: { q: string; a: string }[]): object | null {
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
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
