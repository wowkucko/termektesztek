import 'server-only';
import { prisma } from '@/lib/prisma';
import { allegroSearchProduct, allegroScrapeProduct, closeAllegroBrowser, type AllegroProductData } from '@/lib/allegro';
import { generateArticle } from '@/lib/gemini';
import { findAndDownloadCoverImage, searchImages, downloadImage } from '@/lib/imageSearch';
import { slugify, truncate, parsePriceFt, extractOfferId, normalizeProductName } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

// In-process singleton: csak egy worker fusson egyszerre.
const g = globalThis as unknown as { __syncWorker?: SyncWorker };

const RETRY_HOUR_MS = 60 * 60 * 1000; // alap várakozás, ha a Gemini nem ad pontosabbat
const MAX_RETRY_MS = 24 * 3600 * 1000; // felső korlát (napi kvóta esetén)
const WAIT_TICK_MS = 1000; // rate limit várakozás alatt ennyinként nézzük a leállítást
const MAX_ATTEMPTS = 3;

export class SyncWorker {
  private running = false;
  private stopRequested = false;
  private loopPromise: Promise<void> | null = null;

  async ensureState() {
    const state = await prisma.syncState.findUnique({ where: { id: 'global' } });
    if (!state) {
      await prisma.syncState.create({ data: { id: 'global' } });
    }
  }

  isRunning() {
    return this.running;
  }

  // force=true: az aktív rate limit szünetet átugorja (kényszerített indítás).
  async start(force = false): Promise<string> {
    const { workersDisabled, WORKERS_DISABLED_MESSAGE } = await import('@/lib/workerGuard');
    if (workersDisabled()) return WORKERS_DISABLED_MESSAGE;
    await this.ensureState();
    const state = await prisma.syncState.findUnique({ where: { id: 'global' } });
    if (!state) throw new Error('SyncState nem található.');
    if (state.rateLimited && state.rateLimitUntil && new Date() < state.rateLimitUntil) {
      if (!force) {
        const mins = Math.max(1, Math.round((new Date(state.rateLimitUntil).getTime() - Date.now()) / 60000));
        return `Rate limit miatt szüneteltetve, újrapróbálkozás kb. ${mins} perc múlva.`;
      }
      await prisma.syncState.update({
        where: { id: 'global' },
        data: { rateLimited: false, rateLimitUntil: null },
      });
      await this.log('Rate limit szünet átugorva (kényszerített indítás).');
    }
    if (state.running && this.running) return 'A szinkron már fut.';
    await prisma.syncState.update({
      where: { id: 'global' },
      data: { running: true, paused: false, lastRunAt: new Date() },
    });
    this.stopRequested = false;
    this.running = true;
    this.loopPromise = this.loop().catch((e) => this.log(`Worker hiba: ${String(e).slice(0, 300)}`));
    return 'Szinkron elindítva.';
  }

  async stop(): Promise<string> {
    this.stopRequested = true;
    if (!this.running) {
      // Zombi állapot (pl. a szerver újraindult futás közben): töröljük a maradék
      // running/rateLimit jelzőket, hogy újra lehessen indítani.
      const state = await prisma.syncState.findUnique({ where: { id: 'global' } }).catch(() => null);
      await prisma.syncState
        .update({
          where: { id: 'global' },
          data: {
            running: false,
            rateLimited: false,
            rateLimitUntil: null,
            log: `Leállítva (a korábbi futás állapota törölve).\n${state?.log || ''}`.slice(0, 5000),
          },
        })
        .catch(() => {});
      return 'Leállítva - a korábbi futás állapota törölve, újra indítható.';
    }
    // A rate limit szünetet is töröljük, hogy a leállítás után ne kelljen órákat várni az újraindításhoz.
    await prisma.syncState
      .update({
        where: { id: 'global' },
        data: { rateLimited: false, rateLimitUntil: null, log: 'Leállítás kérve...\n' },
      })
      .catch(() => {});
    return 'Leállítás kérve - azonnal megáll, amint az aktuális munka/várakozás véget ér.';
  }

  async pause(): Promise<string> {
    await this.ensureState();
    await prisma.syncState.update({ where: { id: 'global' }, data: { paused: true } });
    if (!this.running) {
      await prisma.syncState.update({ where: { id: 'global' }, data: { running: false } });
    }
    return 'Szinkron szüneteltetve. A folyamat a következő termék után megáll és megtartja a sort.';
  }

  async resume(): Promise<string> {
    await this.ensureState();
    await prisma.syncState.update({ where: { id: 'global' }, data: { paused: false } });
    // Explicit folytatás: a hátralévő rate limit szünetet sem tartjuk tovább.
    await prisma.syncState
      .update({ where: { id: 'global' }, data: { rateLimited: false, rateLimitUntil: null } })
      .catch(() => {});
    return await this.start();
  }

  private async finish(reason: string) {
    this.running = false;
    this.stopRequested = false;
    await prisma.syncState.update({
      where: { id: 'global' },
      data: { running: false, currentItemId: null, log: `${reason}\n${(await prisma.syncState.findUnique({ where: { id: 'global' } }))?.log || ''}`.slice(0, 5000) },
    }).catch(() => {});
    await closeAllegroBrowser().catch(() => {});
  }

  private async log(msg: string) {
    try {
      const state = await prisma.syncState.findUnique({ where: { id: 'global' } });
      const line = `[${new Date().toLocaleTimeString('hu-HU', { hour12: false })}] ${msg}\n`;
      await prisma.syncState.update({
        where: { id: 'global' },
        data: { log: (line + (state?.log || '')).slice(0, 5000) },
      });
    } catch {
      // logolás nem kritikus
    }
  }

  private async loop() {
    try {
      while (!this.stopRequested) {
        const state = await prisma.syncState.findUnique({ where: { id: 'global' } });
        if (!state) break;

        if (state.paused) {
          await this.finish('Szüneteltetve (paused).');
          return;
        }

        if (state.rateLimited && state.rateLimitUntil && new Date() < state.rateLimitUntil) {
          // Másodpercenként ellenőrizzük, így a Leállítás/Szüneteltetés azonnal hat
          await this.waitRateLimit(new Date(state.rateLimitUntil).getTime());
          continue;
        }
        if (state.rateLimited && state.rateLimitUntil && new Date() >= state.rateLimitUntil) {
          await prisma.syncState.update({
            where: { id: 'global' },
            data: { rateLimited: false, rateLimitUntil: null },
          });
          await this.log('Rate limit lejárt - szinkron folytatása.');
        }

        const item = await prisma.syncProduct.findFirst({
          where: { status: { in: ['QUEUED', 'SCRAPING', 'GENERATING'] } },
          orderBy: { createdAt: 'asc' },
        });
        if (!item) {
          await this.finish('Nincs több feldolgozandó termék.');
          return;
        }

        await this.processItem(item.id);
      }
      await this.finish('Kézi leállítás.');
    } catch (e) {
      await this.finish(`Váratlan hiba: ${String(e).slice(0, 300)}`);
    }
  }

  // Rate limit várakozás: másodpercenként nézi, hogy közben nem jött-e leállítási
  // kérés (stopRequested) vagy szüneteltetés (paused). Korábban 60 mp-es darabokban
  // aludt, így a Leállítás akár egy percet is váratott magára.
  private async waitRateLimit(untilMs: number) {
    while (!this.stopRequested && Date.now() < untilMs) {
      const st = await prisma.syncState.findUnique({ where: { id: 'global' } }).catch(() => null);
      if (st?.paused) return;
      await new Promise((r) => setTimeout(r, Math.min(WAIT_TICK_MS, Math.max(untilMs - Date.now(), 1))));
    }
  }

  // Duplikátum-keresés: ugyanaz az Allegro-ajánlat (offerId) vagy ugyanaz a
  // normalizált terméknév már szerepel egy kész cikkben? Visszatér az okkal,
  // vagy null-lal ha nincs duplikátum.
  private async findDuplicateReason(
    currentItemId: string,
    allegroUrl: string,
    scrapedName: string
  ): Promise<string | null> {
    // 1. offerId-egyezés: ugyanaz a konkrét ajánlat már cikkezve van
    const offerId = extractOfferId(allegroUrl);
    if (offerId) {
      const doneItem = await prisma.syncProduct.findFirst({
        where: { id: { not: currentItemId }, status: 'DONE', allegroUrl: { contains: offerId } },
        select: { name: true, postSlug: true },
      });
      if (doneItem) {
        return `ugyanaz az Allegro-ajánlat (offerId=${offerId}) már szerepel: "${doneItem.name}"${doneItem.postSlug ? ` (/blog/${doneItem.postSlug})` : ''}`;
      }
      const dupPost = await prisma.post.findFirst({
        where: { affiliateUrl: { contains: offerId } },
        select: { title: true, slug: true },
      });
      if (dupPost) {
        return `ugyanaz az Allegro-ajánlat (offerId=${offerId}) már szerepel: "${dupPost.title}" (/blog/${dupPost.slug})`;
      }
    }

    // 2. terméknév-egyezés: a scrape-elt név normalizálva megegyezik egy
    // publikált cikk terméknevével (másik offer, de ugyanaz a termék)
    const norm = normalizeProductName(scrapedName);
    if (norm.length >= 6) {
      const posts = await prisma.post.findMany({
        where: { status: 'PUBLISHED', productName: { not: null } },
        select: { title: true, slug: true, productName: true },
        take: 500,
      });
      for (const p of posts) {
        if (normalizeProductName(p.productName) === norm) {
          return `ugyanaz a terméknév már cikkezve van: "${p.title}" (/blog/${p.slug})`;
        }
      }
    }

    return null;
  }

  private async processItem(id: string) {
    const item = await prisma.syncProduct.findUnique({ where: { id } });
    if (!item) return;

    await prisma.syncState.update({ where: { id: 'global' }, data: { currentItemId: item.id } }).catch(() => {});
    await this.log(`Feldolgozás: "${item.name}"`);

    try {
      // 1. Allegro keresés (ha még nincs URL)
      let allegroUrl = item.allegroUrl;
      let data: AllegroProductData | null = null;

      if (allegroUrl) {
        try {
          const cached = JSON.parse(item.allegroData || 'null') as AllegroProductData | null;
          if (cached && cached.description) data = cached;
        } catch { /* újra scrape-elünk */ }
      }

      if (!data) {
        await prisma.syncProduct.update({ where: { id: item.id }, data: { status: 'SCRAPING' } });
        if (!allegroUrl) {
          allegroUrl = await allegroSearchProduct(item.name);
          if (!allegroUrl) {
            throw new Error(`Az Allegro-n nem található a termék: "${item.name}"`);
          }
          await prisma.syncProduct.update({ where: { id: item.id }, data: { allegroUrl } });
        }
        data = await allegroScrapeProduct(allegroUrl);
        await prisma.syncProduct.update({
          where: { id: item.id },
          data: { allegroData: JSON.stringify(data).slice(0, 900000) },
        });
        await this.log(`Allegro adatok sikeresek: ${data.name} (${data.reviews.length} vélemény)`);
      }

      // 1/b. Duplikátum-védelem (még a Gemini-hívás ELŐTT, hogy ne égessük a limitet):
      // az Allegro-kereső gyakran ugyanazt az ajánlatot adja vissza más
      // terméknévre is - ilyenkor nem írunk újabb cikket ugyanarról.
      // FIGYELEM: a scrape-blokkon KÍVÜL van, hogy a mentett adattal
      // újrapróbálkozó tételeket is elkapja.
      const dupReason = await this.findDuplicateReason(item.id, allegroUrl!, data!.name);
      if (dupReason) {
        await prisma.syncProduct.update({
          where: { id: item.id },
          data: { status: 'SKIPPED', attempts: item.attempts + 1, lastError: `Duplikátum: ${dupReason}` },
        });
        await this.log(`Kihagyva (duplikátum): "${item.name}" - ${dupReason}`);
        return;
      }

      // 2. Gemini cikkgenerálás (retry-események az admin naplóba, hogy lásd a várakozást is)
      await prisma.syncProduct.update({ where: { id: item.id }, data: { status: 'GENERATING' } });
      const gen = await generateArticle(item.name, data, (m) => {
        this.log(m).catch(() => {});
      });
      if (gen.rateLimited) {
        // A Gemini megmondja, mennyit érdemes várni: RPM-blip ~1-2 perc,
        // napi kvóta viszont akár 24 óra. (Korábban mindig 1 óra volt.)
        const retryInMs = gen.retryInMs ?? RETRY_HOUR_MS;
        const until = new Date(Date.now() + Math.min(retryInMs, MAX_RETRY_MS));
        await prisma.syncState.update({
          where: { id: 'global' },
          data: { rateLimited: true, rateLimitUntil: until, running: true },
        });
        await prisma.syncProduct.update({
          where: { id: item.id },
          data: { status: 'QUEUED', attempts: item.attempts + 1, lastError: 'Gemini rate limit - későbbi újrapróbálkozás.' },
        });
        await this.log(`Gemini rate limit! Szünet ${until.toLocaleTimeString('hu-HU')} időpontig.`);
        return; // a loop a következő iterációban várni fog
      }
      if (gen.error || !gen.article) {
        throw new Error(gen.error || 'Üres Gemini válasz.');
      }
      const article = gen.article;

      // 3. Képek letöltése (Gemini után, hogy ne pazaroljunk limitet)
      await this.log('Képek letöltése...');
      const imagePlan = await planArticleImages(article, item.name, data);
      const cover = imagePlan.cover;

      // Ha se borító, se galéria-kép nincs, NE publikáljunk csendben kép nélkül -
      // legyen látható hiba, és a tétel újrapróbálkozzon (max. MAX_ATTEMPTS).
      if (!cover && imagePlan.gallery.length === 0) {
        throw new Error(
          'Nem sikerült képet találni (az Allegro galéria üres és a DDG képkeresés sem adott eredményt) - a cikk kép nélkül nem kerül publikálásra, újrapróbálkozás.'
        );
      }
      await this.log(`Képek: ${imagePlan.gallery.length} db galéria, borító: ${cover ? 'van' : 'nincs'}`);

      // 4. Képhely-jelölők felváltása valódi markdown képekre
      const contentWithImages = await insertImagesIntoContent(article.content, imagePlan.gallery, item.name);

      // 5. Affiliate URL összeállítása (fix tracking paraméterekkel)
      const affiliateUrl = appendAffiliateParams(allegroUrl!);

      // 6. Blogbejegyzés létrehozása AZONNAL PUBlikálva
      const post = await createPostFromArticle(article, item.name, affiliateUrl, cover, contentWithImages, data);
      await prisma.syncProduct.update({
        where: { id: item.id },
        data: { status: 'DONE', postId: post.id, postSlug: post.slug, lastError: null, attempts: item.attempts + 1 },
      });
      await prisma.syncState.update({
        where: { id: 'global' },
        data: { processedCount: { increment: 1 }, currentItemId: null },
      }).catch(() => {});
      await this.log(`Cikk kész és publikálva: ${post.title} (/blog/${post.slug})`);

      revalidatePath('/');
      revalidatePath(`/blog/${post.slug}`);
      revalidatePath('/sitemap.xml');
    } catch (e) {
      const msg = String((e as Error).message || e).slice(0, 400);
      const attempts = item.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await prisma.syncProduct.update({
        where: { id: item.id },
        data: { status: failed ? 'FAILED' : 'QUEUED', attempts, lastError: msg },
      }).catch(() => {});
      await this.log(`Hiba "${item.name}": ${msg}${failed ? ' (KIHAGYVA)' : ` (újrapróbálkozás ${MAX_ATTEMPTS - attempts + 1}x)`}`);
    }
  }
}

async function createPostFromArticle(
  article: import('@/lib/gemini').GeneratedArticle,
  query: string,
  allegroUrl: string,
  cover: string | null,
  content: string,
  data: AllegroProductData
) {
  const { ensureUniquePostSlug, resolveTagIds } = await import('@/lib/data');
  const slug = await ensureUniquePostSlug(slugify(article.title || query));

  // Kategória: a Gemini által választott slug, fallback "egyéb"
  let category = await prisma.category.findUnique({ where: { slug: article.categorySlug } });
  if (!category) {
    const fallback = await prisma.category.findFirst();
    if (!fallback) {
      const created = await prisma.category.create({
        data: { name: 'Egyéb', slug: 'egyeb', description: 'Egyéb terméktesztek.' },
      });
      category = created;
    } else {
      category = fallback;
    }
  }

  const tagIds = await resolveTagIds(article.tags.slice(0, 4));

  // Rating-ésszerűsítés: a Gemini becslését az Allegro átlagértékeléshez (x2) húzzuk,
  // ha nagyban eltér tőle ( bizalmi sáv: ±1,5 pont ). Így elkerüljük a szélsőséges,
  // adattól elrugaszkodott pontszámokat.
  let rating = typeof article.rating === 'number' ? Math.max(0, Math.min(10, article.rating)) : null;
  if (rating != null && data.rating != null) {
    const allegroBased = data.rating * 2; // pl. 4,5/5 -> 9,0
    if (Math.abs(rating - allegroBased) > 1.5) {
      rating = Math.round(((rating + allegroBased) / 2) * 10) / 10; // átlag a kettő felé
    }
  }
  if (rating != null && (article.cons?.length ?? 0) > 2 && rating > 7.5) {
    rating = 7.5; // sok hátránynál nem lehet magas a pont
  }

  return prisma.post.create({
    data: {
      title: article.title,
      slug,
      excerpt: article.excerpt || truncate(content.replace(/[#*>]/g, '').replace(/\s+/g, ' '), 200),
      content,
      coverImage: cover,
      coverImageAlt: `${article.productName || query} - termékteszt`,
      categoryId: category.id,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      productName: article.productName || query,
      productBrand: article.productBrand || null,
      priceFt: parsePriceFt(data.price) ?? null,
      rating,
      pros: JSON.stringify(article.pros?.filter((p) => typeof p === 'string') || []),
      cons: JSON.stringify(article.cons?.filter((c) => typeof c === 'string') || []),
      verdict: article.verdict || null,
      affiliateUrl: allegroUrl,
      seoTitle: article.seoTitle || null,
      seoDescription: article.seoDescription || null,
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
  });
}

// === Kép-tervezés és beillesztés ===

// Az Allegro termék-URL-hez fűzi a fix affiliate tracking paramétereket
// (.env: ALLEGRO_AFFILIATE_PARAMS), plusz egyedi, cikkenkénti utm_content-t
// generál (12 karakteres hex) - igy a statisztikaban latod, melyik cikkbol jottek a kattintasok.
// Ha az URL már tartalmazza őket, nem duplázza.
export function appendAffiliateParams(url: string): string {
  const params = process.env.ALLEGRO_AFFILIATE_PARAMS?.trim() || '';
  if (!params || !url) return url;
  if (url.includes('utm_medium=afiliacja')) return url; // már affiliate-es

  // Egyedi utm_content: 12 karakteres hex (utánozza az Allegro panel link-ID formátumát)
  const { randomBytes } = require('crypto') as typeof import('crypto');
  const utmContent = randomBytes(6).toString('hex');

  const suffix = params.includes('utm_content') ? params : `${params}&utm_content=${utmContent}`;
  return url.includes('?') ? `${url}&${suffix}` : `${url}?${suffix}`;
}

type GalleryImage = { url: string; alt: string; source: string; srcUrl?: string };

// Fájltartalom-alapú deduplikáció: a letöltött kép SHA-256 hash-e alapján
// kiszűrjük, hogy ugyanaz a kép (pl. más URL-ről, más méretben) kétszer ne
// kerüljön be a cikkbe.
async function downloadImageDedup(
  imageUrl: string,
  seenHashes: Set<string>
): Promise<string | null> {
  const local = await downloadImage(imageUrl);
  if (!local) return null;
  try {
    const { createHash } = await import('crypto');
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    const buf = await readFile(path.join(process.cwd(), 'public', local));
    const hash = createHash('sha256').update(buf).digest('hex');
    if (seenHashes.has(hash)) {
      // duplikatum - toroljuk a letoltott fajlt
      await import('fs/promises').then((fsp) => fsp.unlink(path.join(process.cwd(), 'public', local)));
      return null;
    }
    seenHashes.add(hash);
    return local;
  } catch {
    return local; // hash-hiba eseten maradjunk meg a kepnel
  }
}

// Összegyűjti a cikkhez használható képeket - ELTÉRŐ perspektívákkal:
// 1. Allegro termékfotók (a galériából, deduplikálva)
// 2. DDG kiegészítés több szemszögből: használat közben, közelkép, unboxing
// A cover a legelső jó kép, a többi a szövegközi galériába megy.
async function planArticleImages(
  article: import('@/lib/gemini').GeneratedArticle,
  query: string,
  data: AllegroProductData
): Promise<{ cover: string | null; gallery: GalleryImage[] }> {
  const productBase = article.productName || query;
  const seenHashes = new Set<string>();
  const gallery: GalleryImage[] = [];
  const usedUrls = new Set<string>();

  const tryAdd = async (url: string, alt: string, source: string, srcUrl?: string): Promise<boolean> => {
    if (usedUrls.has(url)) return false;
    const local = await downloadImageDedup(url, seenHashes);
    if (!local) return false;
    usedUrls.add(url);
    gallery.push({ url: local, alt: alt.slice(0, 120), source, srcUrl });
    return true;
  };

  // 1. Allegro képek (max 3, elegendo a galeria)
  //    srcUrl: a termekoldal, amrol a kepek szarmaznak (forras-hivatkozas)
  for (const imgUrl of data.images.slice(0, 4)) {
    if (gallery.length >= 3) break;
    await tryAdd(imgUrl, `${productBase} - ${data.name}`, 'allegro', data.url);
  }

  // 2. DDG kiegészítés - több perspektíva, használat közben is:
  //    A query-k sorrendben próbálkoznak, amíg 5 kép össze nem jön.
  const perspectives: { q: string; alt: string }[] = [
    { q: `${productBase} használat közben`, alt: `${productBase} használat közben` },
    { q: `${productBase} közelkép részletek`, alt: `${productBase} - részletek közelről` },
    { q: `${productBase} review`, alt: `${productBase} - teszt` },
    { q: `${productBase} unboxing csomagolás`, alt: `${productBase} - csomagolás, tartozékok` },
    { q: `${query} termékfotó`, alt: `${productBase} - termékfotó` },
  ];

  for (const p of perspectives) {
    if (gallery.length >= 5) break;
    // Egy kis szünet a DDG hívások között, hogy ne rate-limiteljük a keresőt
    await new Promise((r) => setTimeout(r, 600));
    try {
      const results = await searchImages(p.q, 4);
      for (const r of results) {
        if (gallery.length >= 5) break;
        // Forras-hivatkozas: a DDG a kepet publikalo oldal domainjet adja meg
        const srcUrl = r.source ? `https://${r.source.replace(/^https?:\/\//, '')}` : undefined;
        await tryAdd(r.url, p.alt, 'ddg', srcUrl);
      }
    } catch {
      // következő perspektíva
    }
  }

  const cover = gallery.length > 0 ? gallery[0].url : (await findAndDownloadCoverImage(productBase, [query]) ?? null);
  return { cover, gallery };
}

// Forrás-felirat HTML a kép eredete szerint - a forrásoldalra mutató hivatkozással.
function imageSourceCaptionHtml(img: GalleryImage): string {
  const linkAttrs = 'target="_blank" rel="noopener noreferrer"';
  if (img.source === 'allegro' && img.srcUrl) {
    return `Forrás: az értékesítő ajánlata az <a href="${img.srcUrl}" ${linkAttrs}>allegro.hu-n</a>`;
  }
  if (img.srcUrl) {
    let host = 'internet';
    try {
      host = new URL(img.srcUrl).hostname.replace(/^www\./, '');
    } catch {
      // érvénytelen URL - sima szöveg marad
    }
    return `Forrás: <a href="${img.srcUrl}" ${linkAttrs}>${host}</a>`;
  }
  return 'Forrás: internet';
}

// A [KEP: ...] jelölőket felváltja markdown képekre, a kép alá elegáns
// forrás-jelöléssel (dőlt, kicsi szöveg - a .post-content CSS-ben stílusozva).
async function insertImagesIntoContent(
  content: string,
  gallery: GalleryImage[],
  query: string
): Promise<string> {
  const markers = [...content.matchAll(/^\s*\[KEP:\s*([^\]]+?)\s*\]\s*$/gim)];
  let result = content;
  const used = new Set<string>();
  let imgIdx = 0;

  const mdFor = (img: GalleryImage, alt: string): string =>
    `![${alt}](${img.url})\n\n<sub class="img-source">${imageSourceCaptionHtml(img)}</sub>`;

  for (const m of markers) {
    const marker = m[0];
    const alt = `${query} - ${m[1].trim()}`.slice(0, 150);
    const img = gallery[imgIdx];
    if (!img) break;
    used.add(img.url);
    result = result.replace(marker, mdFor(img, alt));
    imgIdx++;
  }

  // Töröljük a maradék kitöltetlen jelölőket
  result = result.replace(/^\s*\[KEP:\s*[^\]]+\]\s*$/gim, '');

  // Fölösleges képek a cikk végére
  const leftovers = gallery.filter((g) => !used.has(g.url)).slice(0, 3);
  if (leftovers.length > 0 && result.trim().length > 0) {
    const tail = leftovers.map((img) => `\n\n${mdFor(img, img.alt)}`).join('');
    result = result.trimEnd() + tail;
  }

  return result;
}

export function getSyncWorker(): SyncWorker {
  if (!g.__syncWorker) g.__syncWorker = new SyncWorker();
  return g.__syncWorker;
}
