import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { Prisma } from '@prisma/client';
import { cache } from 'react';

const publishedWhere: Prisma.PostWhereInput = {
  status: 'PUBLISHED',
  publishedAt: { lte: new Date() },
};

export const postListInclude = {
  category: true,
  tags: { include: { tag: true } },
} satisfies Prisma.PostInclude;

type PostRaw = Prisma.PostGetPayload<{ include: typeof postListInclude }>;

// A "pros" és "cons" mezőket a SQLite-ban JSON stringként tároljuk (nincs natív
// tömb típus), ezért minden lekérdezés után feloldjuk őket valódi tömbbé.
export type PostWithRelations = Omit<PostRaw, 'pros' | 'cons'> & { pros: string[]; cons: string[] };

function safeParseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function parsePost(post: PostRaw): PostWithRelations {
  return {
    ...post,
    pros: safeParseStringArray(post.pros),
    cons: safeParseStringArray(post.cons),
  };
}

export async function getPublishedPosts(options?: {
  take?: number;
  skip?: number;
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
}) {
  const { take = 12, skip = 0, categorySlug, tagSlug, search } = options ?? {};

  const where: Prisma.PostWhereInput = {
    ...publishedWhere,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(tagSlug ? { tags: { some: { tag: { slug: tagSlug } } } } : {}),
    // Megjegyzés: SQLite-ban a "mode: insensitive" nem támogatott (ez PostgreSQL-
    // specifikus). A SQLite LIKE operátora ASCII karaktereknél alapból nem
    // kis-nagybetű érzékeny, ami a legtöbb kereséshez elég jó közelítés.
    ...(search
      ? {
          OR: [
            { title: { contains: search } },
            { excerpt: { contains: search } },
            { productName: { contains: search } },
          ],
        }
      : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: postListInclude,
      orderBy: { publishedAt: 'desc' },
      take,
      skip,
    }),
    prisma.post.count({ where }),
  ]);

  return { posts: posts.map(parsePost), total };
}

// React cache(): az azonos kérésen belüli ismételt hívásokat (pl. Header + Footer +
// oldal ugyanazt a kategória-listát kéri) egyetlen DB lekérdezésre fűzi össze.
export const getFeaturedPost = cache(async () => {
  const post = await prisma.post.findFirst({
    where: publishedWhere,
    include: postListInclude,
    orderBy: { publishedAt: 'desc' },
  });
  return post ? parsePost(post) : null;
});

export const getPostBySlug = cache(async (slug: string) => {
  const post = await prisma.post.findUnique({
    where: { slug },
    include: postListInclude,
  });
  return post ? parsePost(post) : null;
});

// Toplistákhoz: egy kategória legjobbra értékelt tesztjei, pontszám szerint
// csökkenő sorrendben. Csak értékelt (rating != null) cikkek kerülnek be.
// maxPriceFt-tal ársávos listák is építhetők ("X alatt").
export async function getTopRatedPosts(categorySlug: string, take = 10, maxPriceFt?: number | null) {
  const posts = await prisma.post.findMany({
    where: {
      ...publishedWhere,
      category: { slug: categorySlug },
      rating: { not: null },
      ...(maxPriceFt != null ? { priceFt: { lte: maxPriceFt } } : {}),
    },
    include: postListInclude,
    orderBy: [{ rating: 'desc' }, { publishedAt: 'desc' }],
    take,
  });
  return posts.map(parsePost);
}

// Minden kategórián átívelő toplista (szezonális hub-oldalakhoz)
export async function getTopRatedOverall(take = 10) {
  const posts = await prisma.post.findMany({
    where: { ...publishedWhere, rating: { not: null } },
    include: postListInclude,
    orderBy: [{ rating: 'desc' }, { publishedAt: 'desc' }],
    take,
  });
  return posts.map(parsePost);
}

// ISO hétszám (a "hét tesztje" rotációhoz - determinisztikus, hetente vált)
function isoWeekNumber(d = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7; // hétfő = 0
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

// A hét tesztje: a legjobbra értékeltek közül hetente rotálva választunk.
// excludeId-vel elkerülhető, hogy a kiemelt (legfrissebb) cikkel egyezzen.
export async function getTestOfTheWeek(excludeId?: string) {
  const top = await getTopRatedOverall(5);
  const pool = excludeId ? top.filter((p) => p.id !== excludeId) : top;
  if (pool.length === 0) return top[0] ?? null;
  return pool[isoWeekNumber() % pool.length];
}

// Főoldali toplista-sávhoz: minden kategória győztese (#1 helyezett)
export async function getCategoryTopPicks(): Promise<
  { category: { id: string; name: string; slug: string }; pick: PostWithRelations }[]
> {
  const cats = await getAllCategories();
  const out: { category: { id: string; name: string; slug: string }; pick: PostWithRelations }[] = [];
  for (const c of cats) {
    const top = await getTopRatedPosts(c.slug, 1);
    if (top.length > 0) out.push({ category: { id: c.id, name: c.name, slug: c.slug }, pick: top[0] });
  }
  return out;
}

// Címkefelhőhöz: a leggyakoribb címkék publikált cikkszámmal
export async function getTopTags(take = 10): Promise<{ name: string; slug: string; count: number }[]> {
  const groups = await prisma.postTag.groupBy({
    by: ['tagId'],
    where: { post: { status: 'PUBLISHED', publishedAt: { lte: new Date() } } },
    _count: { _all: true },
  });
  if (groups.length === 0) return [];
  const tags = await prisma.tag.findMany({
    where: { id: { in: groups.map((g) => g.tagId) } },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(tags.map((t) => [t.id, t]));
  return groups
    .map((g) => ({ ...(byId.get(g.tagId) as { name: string; slug: string }), count: g._count._all }))
    .filter((t) => t.name)
    .sort((a, b) => b.count - a.count)
    .slice(0, take);
}

// Márkák a publikált tesztek alapján (márka-hubokhoz)
export async function getAllBrands(): Promise<{ name: string; slug: string; count: number }[]> {
  const groups = await prisma.post.groupBy({
    by: ['productBrand'],
    where: { ...publishedWhere, productBrand: { not: null } },
    _count: { _all: true },
  });
  return groups
    .filter((g) => g.productBrand)
    .map((g) => ({ name: g.productBrand as string, slug: slugify(g.productBrand as string), count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function getBrandBySlug(slug: string) {
  const brands = await getAllBrands();
  return brands.find((b) => b.slug === slug) ?? null;
}

export async function getBrandPosts(brandName: string, take = 12) {
  const posts = await prisma.post.findMany({
    where: { ...publishedWhere, productBrand: brandName },
    include: postListInclude,
    orderBy: [{ rating: 'desc' }, { publishedAt: 'desc' }],
    take,
  });
  return posts.map(parsePost);
}

// Kommentek egy cikkhez (olvasói UGC) + összesített csillag-statisztika
export async function getPostComments(postId: string, take = 50) {
  return prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function getCommentStats(postId: string): Promise<{ count: number; avg: number | null }> {
  const agg = await prisma.comment.aggregate({
    where: { postId, rating: { not: null } },
    _count: { _all: true },
    _avg: { rating: true },
  });
  return { count: agg._count._all, avg: agg._avg.rating };
}

// A cikk-tartalomban található képek száma: markdown (![alt](url)) és HTML
// (<img>) formátumot is számol – ezt használja a „kép nélküli cikkek" ellenőrzés.
export function countContentImages(content: string): number {
  const matches = content.match(/!\[[^\]]*\]\([^)]+\)|<img\b[^>]*>/gi);
  return matches ? matches.length : 0;
}

export type PostImageHealth = {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date | null;
  updatedAt: Date;
  hasCover: boolean;
  contentImageCount: number;
};

// Publikált bejegyzések, amelyeknél hiányzik a borítókép vagy a szövegközi kép.
// Az admin áttekintőn és a bejegyzés-listán figyelmeztetésként jelenik meg, hogy
// azonnal látszódjon, ha egy (pl. automatikus szinkronból született) cikk kép
// nélkül maradt.
export const getPostsMissingImages = cache(async (): Promise<PostImageHealth[]> => {
  const posts = await prisma.post.findMany({
    where: publishedWhere,
    select: { id: true, title: true, slug: true, publishedAt: true, updatedAt: true, coverImage: true, content: true },
    orderBy: { publishedAt: 'desc' },
  });
  return posts
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      hasCover: Boolean(p.coverImage && p.coverImage.trim()),
      contentImageCount: countContentImages(p.content),
    }))
    .filter((p) => !p.hasCover || p.contentImageCount === 0);
});

// generateStaticParams-hoz: a build idején előre renderelhető (publikált)
// cikk-slugok, így az oldalak statikus HTML-ként szolgálódnak ki – az első
// látogatónak sem kell SSR-re várnia, és a Googlebot gyorsan kapja a tartalmat.
export async function getPublishedPostSlugs(): Promise<string[]> {
  const posts = await prisma.post.findMany({
    where: publishedWhere,
    select: { slug: true },
  });
  return posts.map((p) => p.slug);
}

export async function getRelatedPosts(post: { id: string; categoryId: string }, take = 3) {
  const posts = await prisma.post.findMany({
    where: {
      ...publishedWhere,
      id: { not: post.id },
      categoryId: post.categoryId,
    },
    include: postListInclude,
    orderBy: { publishedAt: 'desc' },
    take,
  });
  return posts.map(parsePost);
}

// Szógyakoriság-alapú kulcsszó-kinyerés: a cikk címéből, összefoglalójából és
// terméknevéből a leggyakoribb értelmes szavak (stopword-ök kiszűrése).
const STOPWORDS = new Set([
  'a', 'az', 'egy', 'és', 'vagy', 'de', 'hogy', 'mint', 'van', 'vannak', 'ez', 'ezt', 'azt',
  'is', 'nem', 'igen', 'még', 'már', 'csak', 'mind', 'össze', 'vel', 'helyett', 'után', 'alatt',
  'ellen', 'kell', 'lehet', 'teszt', 'vélemény', 'velemeny', 'termék', 'termek', 'mit', 'tud',
  'mit', 'hogyan', 'milyen', 'melyik', 'ezért', 'ezert', 'nem', 'majd', 'lett', 'lett',
  'the', 'and', 'for', 'with', 'tesztje', 'tesztek', 'legjobb', 'vásárlás', 'vasarlas',
]);

function extractKeywords(text: string, max = 8): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\wáéíóöőúüűñäôàèìòù0-9\s-]/gi, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  // gyakoriság szerint rendezve, egyedi szavak
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

/**
 * Relevancia-alapú kapcsolódó tesztek: kulcsszavak (cím + összefoglaló + terméknév),
 * termék-márka, címke-átfedés és kategória alapján pontoz, a 5 legjobbat adja vissza.
 * A pontozás súlyai: cím-kulcsszó találat 3p, terméknév/márka találat 5p,
 * címke-átfedés 2p/címke, azonos kategória 3p, frissebb cikk +1p bónusz.
 */
export async function getRelevantPosts(
  current: { id: string; title: string; excerpt: string; productName?: string | null; productBrand?: string | null; categoryId: string; tags: { tag: { name: string } }[] },
  take = 5
): Promise<PostWithRelations[]> {
  const candidates = await prisma.post.findMany({
    where: { ...publishedWhere, id: { not: current.id } },
    include: postListInclude,
    take: 60, // a legutóbbi 60 publikált cikkből választunk (teljes körű pörgetés helyett)
    orderBy: { publishedAt: 'desc' },
  });

  // Az aktuális cikk adatai
  const myKeywords = extractKeywords(`${current.title} ${current.excerpt} ${current.productName || ''} ${current.productBrand || ''}`);
  const myTagNames = new Set(current.tags.map((t) => t.tag.name.toLowerCase()));
  const myBrand = (current.productBrand || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 3);

  const scored = candidates.map((c) => {
    let score = 0;
    const haystackTitle = c.title.toLowerCase();
    const haystackProduct = `${c.productName || ''} ${c.productBrand || ''}`.toLowerCase();
    const haystackAll = `${c.title} ${c.excerpt}`.toLowerCase();

    // 1. Kulcsszó-találatok a címében / összefoglalójában
    for (const kw of myKeywords) {
      if (haystackTitle.includes(kw)) score += 3;
      else if (haystackAll.includes(kw)) score += 1;
    }
    // 2. Ugyanaz a márka a terméknévben
    for (const b of myBrand) {
      if (haystackProduct.includes(b)) score += 5;
    }
    // 3. Címke-átfedés
    const cTagNames = c.tags.map((t) => t.tag.name.toLowerCase());
    for (const t of cTagNames) {
      if (myTagNames.has(t)) score += 2;
    }
    // 4. Azonos kategória
    if (c.categoryId === current.categoryId) score += 3;
    // 5. Az aktuális cikk termékneve találat a másik címében (pl. ugyanaz a termékcsoport)
    if (current.productName) {
      const pn = current.productName.toLowerCase();
      if (pn && haystackTitle.includes(pn.split(/\s+/)[0])) score += 4;
    }

    return { post: c, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .filter((s) => s.score > 0)
    .map((s) => parsePost(s.post));
}

export const getAllCategories = cache(async () => {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { posts: { where: publishedWhere } } } },
  });
});

export const getCategoryBySlug = cache(async (slug: string) => {
  return prisma.category.findUnique({ where: { slug } });
});

export const getAllCategoriesForAdmin = cache(async () => {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { posts: true } } },
  });
});

export const getAllTags = cache(async () => {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { posts: true } } },
  });
});

export const getTagBySlug = cache(async (slug: string) => {
  return prisma.tag.findUnique({ where: { slug } });
});

export async function incrementPostViews(id: string) {
  try {
    await prisma.post.update({ where: { id }, data: { views: { increment: 1 } } });
  } catch {
    // néma hiba - a megtekintésszám sosem kritikus
  }
}

export async function ensureUniquePostSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug || 'bejegyzes';
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

export async function ensureUniqueCategorySlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug || 'kategoria';
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

export async function ensureUniqueTagSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug || 'cimke';
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.tag.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

export async function resolveTagIds(tagNames: string[]): Promise<string[]> {
  const ids: string[] = [];
  const seenSlugs = new Set<string>();
  for (const rawName of tagNames) {
    const name = rawName.trim();
    if (!name) continue;
    const tagSlug = slugify(name);
    if (!tagSlug) continue;
    // Ugyanarra a slugra skálázódó címkék (pl. "Razer" vs "razer") egy címke -
    // a második előfordulást kihagyjuk, így a slug-unique sosem sérülhet.
    if (seenSlugs.has(tagSlug)) continue;
    seenSlugs.add(tagSlug);
    // Először slug alapján keresünk (a slug unique), utána name szerint -
    // így név-variánsok (kis/nagybetű) is a meglévő címkéhez kapcsoldnak.
    let tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
    if (!tag) {
      try {
        tag = await prisma.tag.create({ data: { name, slug: tagSlug } });
      } catch {
        // Párhuzamos futásnál (race) mégis létrejött - ilyenkor a meglévőt keressük
        tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
        if (!tag) continue;
      }
    }
    ids.push(tag.id);
  }
  return ids;
}

export const getPostForEdit = cache(async (id: string) => {
  const post = await prisma.post.findUnique({
    where: { id },
    include: postListInclude,
  });
  return post ? parsePost(post) : null;
});

export const getAllPostsForAdmin = cache(async () => {
  const posts = await prisma.post.findMany({
    include: postListInclude,
    orderBy: { updatedAt: 'desc' },
  });
  return posts.map(parsePost);
});
