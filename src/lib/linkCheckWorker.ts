import 'server-only';
import { prisma } from '@/lib/prisma';
import {
  allegroCheckOfferAlive,
  allegroScrapeProduct,
  allegroSearchCandidates,
  closeAllegroBrowser,
  normalizeForMatch,
  parseNumericPrice,
  prepareSearchQuery,
  type AllegroSearchCandidate,
} from '@/lib/allegro';
import { matchAllegroCandidates, type AllegroMatchCandidate, type MatchBatchEntry } from '@/lib/gemini';
import { appendAffiliateParams } from '@/lib/syncWorker';
import { revalidatePath } from 'next/cache';

// In-process singleton: csak egy link-ellenőrző fusson egyszerre.
const g = globalThis as unknown as { __linkCheckWorker?: LinkCheckWorker };

const RETRY_HOUR_MS = 60 * 60 * 1000; // alap várakozás, ha a Gemini nem ad pontosabbat
const MAX_RETRY_MS = 24 * 3600 * 1000; // felső korlát (napi kvóta esetén)
const WAIT_TICK_MS = 1000; // rate limit várakozás alatt ennyinként nézzük a leállítást
const MAX_ATTEMPTS = 3;
// Hány halott linkhez férjen el egy Gemini hívás - így használjuk ki okosan a rate limitet.
const MATCH_BATCH_SIZE = parseInt(process.env.LINKCHECK_MATCH_BATCH || '4', 10) || 4;

// A loop csak ezeket veszi fel; a MATCHING tételek a pufferben élnek, azokat
// a flushMatches dolgozza fel. (Újraindítás után a start() QUEUED-re állítja.)
const PICK_STATUSES = ['QUEUED', 'CHECKING', 'SEARCHING'];
const ACTIVE_STATUSES = ['QUEUED', 'CHECKING', 'SEARCHING', 'MATCHING'];

export class LinkCheckWorker {
  private running = false;
  private stopRequested = false;
  private loopPromise: Promise<void> | null = null;
  private pendingMatches: { itemId: string; entry: MatchBatchEntry }[] = [];

  async ensureState() {
    const state = await prisma.linkCheckState.findUnique({ where: { id: 'global' } });
    if (!state) {
      await prisma.linkCheckState.create({ data: { id: 'global' } });
    }
  }

  isRunning() {
    return this.running;
  }

  // A sort a jelenlegi PUBLISHED posztok affiliate linkjeiből építi újra.
  async rebuild(): Promise<string> {
    await this.ensureState();
    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED', affiliateUrl: { contains: 'allegro' } },
      select: { id: true, title: true, affiliateUrl: true },
    });
    await prisma.linkCheckItem.deleteMany({});
    if (posts.length > 0) {
      await prisma.linkCheckItem.createMany({
        data: posts.map((p) => ({ postId: p.id, postTitle: p.title, oldUrl: p.affiliateUrl! })),
      });
    }
    await prisma.linkCheckState.update({
      where: { id: 'global' },
      data: { processedCount: 0, replacedCount: 0, log: '' },
    }).catch(() => {});
    await this.log(`Lista újraépítve: ${posts.length} bejegyzés került a sorba.`);
    return `${posts.length} link a sorban.`;
  }

  // force=true: az aktív rate limit szünetet átugorja (kényszerített indítás).
  async start(force = false): Promise<string> {
    const { workersDisabled, WORKERS_DISABLED_MESSAGE } = await import('@/lib/workerGuard');
    if (workersDisabled()) return WORKERS_DISABLED_MESSAGE;
    await this.ensureState();
    const state = await prisma.linkCheckState.findUnique({ where: { id: 'global' } });
    if (!state) throw new Error('LinkCheckState nem található.');
    if (state.rateLimited && state.rateLimitUntil && new Date() < state.rateLimitUntil) {
      if (!force) {
        const mins = Math.max(1, Math.round((new Date(state.rateLimitUntil).getTime() - Date.now()) / 60000));
        return `Rate limit miatt szüneteltetve, újrapróbálkozás kb. ${mins} perc múlva.`;
      }
      // force: átugorjuk a szünetet
      await prisma.linkCheckState.update({
        where: { id: 'global' },
        data: { rateLimited: false, rateLimitUntil: null },
      });
      await this.log('Rate limit szünet átugorva (kényszerített indítás).');
    }
    if (state.running && this.running) return 'A link-ellenőrzés már fut.';

    // Üres sor esetén automatikusan felépítjük a posztokból
    const count = await prisma.linkCheckItem.count();
    if (count === 0) {
      await this.rebuild();
    }

    // Előző futásból maradt MATCHING tételek (a puffer elveszett) -> visszasorolás
    await prisma.linkCheckItem.updateMany({
      where: { status: 'MATCHING' },
      data: { status: 'QUEUED' },
    });

    await prisma.linkCheckState.update({
      where: { id: 'global' },
      data: { running: true, paused: false, lastRunAt: new Date() },
    });
    this.stopRequested = false;
    this.running = true;
    this.loopPromise = this.loop().catch((e) => this.log(`Worker hiba: ${String(e).slice(0, 300)}`));
    return 'Link-ellenőrzés elindítva.';
  }

  async stop(): Promise<string> {
    this.stopRequested = true;
    if (!this.running) {
      // Zombi állapot (pl. a szerver újraindult futás közben): töröljük a maradék
      // running/rateLimit jelzőket, hogy újra lehessen indítani.
      const state = await prisma.linkCheckState.findUnique({ where: { id: 'global' } }).catch(() => null);
      await prisma.linkCheckState
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
    await prisma.linkCheckState
      .update({
        where: { id: 'global' },
        data: { rateLimited: false, rateLimitUntil: null, log: 'Leállítás kérve...\n' },
      })
      .catch(() => {});
    return 'Leállítás kérve - azonnal megáll, amint az aktuális munka/várakozás véget ér.';
  }

  async pause(): Promise<string> {
    await this.ensureState();
    await prisma.linkCheckState.update({ where: { id: 'global' }, data: { paused: true } });
    if (!this.running) {
      await prisma.linkCheckState.update({ where: { id: 'global' }, data: { running: false } });
    }
    return 'Link-ellenőrzés szüneteltetve. A folyamat a következő link után megáll és megtartja a sort.';
  }

  async resume(): Promise<string> {
    await this.ensureState();
    await prisma.linkCheckState.update({ where: { id: 'global' }, data: { paused: false } });
    // Explicit folytatás: a hátralévő rate limit szünetet sem tartjuk tovább.
    await prisma.linkCheckState
      .update({ where: { id: 'global' }, data: { rateLimited: false, rateLimitUntil: null } })
      .catch(() => {});
    return await this.start();
  }

  private async requeuePending() {
    for (const p of this.pendingMatches) {
      const it = await prisma.linkCheckItem.findUnique({ where: { id: p.itemId } });
      if (it && it.status === 'MATCHING') {
        await prisma.linkCheckItem
          .update({ where: { id: it.id }, data: { status: 'QUEUED', attempts: it.attempts + 1 } })
          .catch(() => {});
      }
    }
    this.pendingMatches = [];
  }

  private async finish(reason: string) {
    await this.requeuePending();
    this.running = false;
    this.stopRequested = false;
    await prisma.linkCheckState
      .update({
        where: { id: 'global' },
        data: {
          running: false,
          currentItemId: null,
          log: `${reason}\n${(await prisma.linkCheckState.findUnique({ where: { id: 'global' } }))?.log || ''}`.slice(0, 5000),
        },
      })
      .catch(() => {});
    await closeAllegroBrowser().catch(() => {});
  }

  private async log(msg: string) {
    try {
      const state = await prisma.linkCheckState.findUnique({ where: { id: 'global' } });
      const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}\n`;
      await prisma.linkCheckState.update({
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
        const state = await prisma.linkCheckState.findUnique({ where: { id: 'global' } });
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
          await prisma.linkCheckState.update({
            where: { id: 'global' },
            data: { rateLimited: false, rateLimitUntil: null },
          });
          await this.log('Rate limit lejárt - ellenőrzés folytatása.');
        }

        const item = await prisma.linkCheckItem.findFirst({
          where: { status: { in: PICK_STATUSES } },
          orderBy: { createdAt: 'asc' },
        });
        if (!item) {
          // Maradt félkész párosítás a pufferben? Küldjük el egy batchben.
          if (this.pendingMatches.length > 0) {
            await this.flushMatches();
            continue;
          }
          await this.finish('Nincs több ellenőrizendő link.');
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
      const st = await prisma.linkCheckState.findUnique({ where: { id: 'global' } }).catch(() => null);
      if (st?.paused) return;
      await new Promise((r) => setTimeout(r, Math.min(WAIT_TICK_MS, Math.max(untilMs - Date.now(), 1))));
    }
  }

  private async processItem(id: string) {
    const item = await prisma.linkCheckItem.findUnique({ where: { id } });
    if (!item) return;

    await prisma.linkCheckState.update({ where: { id: 'global' }, data: { currentItemId: item.id } }).catch(() => {});
    await this.log(`Ellenőrzés: "${item.postTitle}"`);

    try {
      const post = await prisma.post.findUnique({ where: { id: item.postId } });
      if (!post) throw new Error('A bejegyzés nem található (törölve?).');
      if (!post.affiliateUrl) throw new Error('A bejegyzésnek nincs affiliate linkje.');

      // 1. Él-e még a link? A sorban rögzített oldUrl-t ellenőrizzük (nem a poszt
      //    aktuális értékét), hogy a korábbi csere utáni eltérés se okozzon zavart.
      const checkUrl = item.oldUrl || post.affiliateUrl;
      await prisma.linkCheckItem.update({ where: { id: item.id }, data: { status: 'CHECKING' } });
      const check = await allegroCheckOfferAlive(checkUrl);
      if (check.alive) {
        await prisma.linkCheckItem.update({
          where: { id: item.id },
          data: { status: 'OK', alive: true, reason: 'A link él.', lastError: null, attempts: item.attempts + 1 },
        });
        await prisma.linkCheckState
          .update({ where: { id: 'global' }, data: { processedCount: { increment: 1 }, currentItemId: null } })
          .catch(() => {});
        await this.log(`Él: "${item.postTitle}"`);
        return;
      }
      await this.log(`Halott link: "${item.postTitle}" (${check.reason || 'nem elérhető'})`);

      // 2. Keresés az Allegro-n
      await prisma.linkCheckItem.update({
        where: { id: item.id },
        data: { status: 'SEARCHING', reason: check.reason, lastError: null },
      });
      const query = [post.productBrand, post.productName].filter(Boolean).join(' ').trim() || post.title;
      const searchResults = await allegroSearchCandidates(prepareSearchQuery(query), 8);
      if (searchResults.length === 0) {
        await prisma.linkCheckItem.update({
          where: { id: item.id },
          data: { status: 'NOT_FOUND', alive: false, reason: `Nincs találat erre: "${query}"`, attempts: item.attempts + 1 },
        });
        await prisma.linkCheckState
          .update({ where: { id: 'global' }, data: { processedCount: { increment: 1 }, currentItemId: null } })
          .catch(() => {});
        await this.log(`Nincs találat: "${item.postTitle}"`);
        return;
      }

      // 3. Referencia adatok (régi ár/leírás/paraméterek a szinkronból, ha van)
      let oldPrice: number | null = null;
      let oldDescription: string | undefined;
      let oldParameters: { label: string; value: string }[] | undefined;
      const sync = await prisma.syncProduct.findFirst({ where: { postId: item.postId } });
      if (sync?.allegroData) {
        try {
          const d = JSON.parse(sync.allegroData) as {
            price?: string;
            description?: string;
            parameters?: { label: string; value: string }[];
          };
          oldPrice = parseNumericPrice(d.price);
          oldDescription = d.description?.slice(0, 400);
          oldParameters = d.parameters?.slice(0, 8);
        } catch {
          // rossz JSON - referencia nélkül megyünk tovább
        }
      }

      // 4. Rangsorolás (ár-hasonlóság + márka/modell egyezés) és a top kandidátusok lekaparása
      const ranked = rankCandidates(searchResults, post, oldPrice);
      const scraped: AllegroMatchCandidate[] = [];
      for (const c of ranked.slice(0, 6)) {
        if (scraped.length >= 4) break;
        try {
          const d = await allegroScrapeProduct(c.url);
          if (!d.name || d.name === 'Ismeretlen termék' || d.name.length < 4) continue;
          scraped.push({
            title: d.name,
            price: d.price,
            seller: c.seller,
            description: d.description.slice(0, 300),
            parameters: d.parameters.slice(0, 6),
            url: d.url || c.url,
          });
        } catch {
          // következő kandidátus
        }
      }
      if (scraped.length === 0) {
        await prisma.linkCheckItem.update({
          where: { id: item.id },
          data: { status: 'NOT_FOUND', alive: false, reason: 'A találatok közül egyik sem volt lekaparható.', attempts: item.attempts + 1 },
        });
        await prisma.linkCheckState
          .update({ where: { id: 'global' }, data: { processedCount: { increment: 1 }, currentItemId: null } })
          .catch(() => {});
        await this.log(`Nincs lekaparható kandidátus: "${item.postTitle}"`);
        return;
      }

      // 5. Gemini párosítás - batch pufferbe, és ha megtelt, egy hívással kiértékeljük
      await prisma.linkCheckItem.update({ where: { id: item.id }, data: { status: 'MATCHING' } });
      this.pendingMatches.push({
        itemId: item.id,
        entry: {
          postId: item.id,
          productName: post.productName || post.title,
          productBrand: post.productBrand,
          oldPrice: oldPrice != null ? String(oldPrice) : undefined,
          oldDescription,
          oldParameters,
          candidates: scraped,
        },
      });
      if (this.pendingMatches.length >= MATCH_BATCH_SIZE) {
        await this.flushMatches();
      }
    } catch (e) {
      const msg = String((e as Error).message || e).slice(0, 400);
      const attempts = item.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await prisma.linkCheckItem
        .update({
          where: { id: item.id },
          data: { status: failed ? 'FAILED' : 'QUEUED', attempts, lastError: msg },
        })
        .catch(() => {});
      await this.log(`Hiba "${item.postTitle}": ${msg}${failed ? ' (KIHAGYVA)' : ` (újrapróbálkozás ${MAX_ATTEMPTS - attempts + 1}x)`}`);
    }
  }

  // Egy Gemini hívással kiértékeli a pufferben lévő párosításokat.
  private async flushMatches() {
    const batch = this.pendingMatches.splice(0);
    if (batch.length === 0) return;

    await this.log(`Gemini párosítás: ${batch.length} termék (${batch.reduce((s, b) => s + b.entry.candidates.length, 0)} kandidátus)...`);
    const res = await matchAllegroCandidates(batch.map((b) => b.entry));

    if (res.rateLimited) {
      const until = new Date(Date.now() + Math.min(res.retryInMs ?? RETRY_HOUR_MS, MAX_RETRY_MS));
      await prisma.linkCheckState.update({
        where: { id: 'global' },
        data: { rateLimited: true, rateLimitUntil: until, running: true },
      });
      for (const b of batch) {
        const it = await prisma.linkCheckItem.findUnique({ where: { id: b.itemId } });
        if (!it) continue;
        await prisma.linkCheckItem
          .update({ where: { id: it.id }, data: { status: 'QUEUED', attempts: it.attempts + 1, lastError: 'Gemini rate limit - későbbi újrapróbálkozás.' } })
          .catch(() => {});
      }
      await this.log(`Gemini rate limit! Szünet ${until.toLocaleTimeString('hu-HU')} időpontig.`);
      return;
    }

    if (res.error || !res.results) {
      for (const b of batch) {
        const it = await prisma.linkCheckItem.findUnique({ where: { id: b.itemId } });
        if (!it) continue;
        const attempts = it.attempts + 1;
        const failed = attempts >= MAX_ATTEMPTS;
        await prisma.linkCheckItem
          .update({
            where: { id: it.id },
            data: { status: failed ? 'FAILED' : 'QUEUED', attempts, lastError: res.error || 'Ismeretlen Gemini hiba.' },
          })
          .catch(() => {});
      }
      await this.log(`Gemini hiba: ${res.error}`);
      return;
    }

    for (const b of batch) {
      const it = await prisma.linkCheckItem.findUnique({ where: { id: b.itemId } });
      if (!it) continue;
      const result = res.results.find((r) => r.postId === b.itemId);

      if (!result || result.chosenIndex == null) {
        await prisma.linkCheckItem.update({
          where: { id: it.id },
          data: { status: 'NOT_FOUND', reason: result?.reason || 'A Gemini nem talált egyezést.', attempts: it.attempts + 1 },
        });
        await prisma.linkCheckState
          .update({ where: { id: 'global' }, data: { processedCount: { increment: 1 }, currentItemId: null } })
          .catch(() => {});
        await this.log(`Nincs egyezés: "${it.postTitle}" (${result?.reason || ''})`);
        continue;
      }

      const cand = b.entry.candidates[result.chosenIndex];
      if (!cand) {
        await prisma.linkCheckItem.update({
          where: { id: it.id },
          data: { status: 'NOT_FOUND', reason: 'A Gemini által választott kandidátus nem elérhető.', attempts: it.attempts + 1 },
        });
        await prisma.linkCheckState
          .update({ where: { id: 'global' }, data: { processedCount: { increment: 1 }, currentItemId: null } })
          .catch(() => {});
        continue;
      }

      const newUrl = appendAffiliateParams(cand.url);
      await prisma.post.update({ where: { id: it.postId }, data: { affiliateUrl: newUrl } });
      await prisma.linkCheckItem.update({
        where: { id: it.id },
        data: { status: 'REPLACED', newUrl, reason: result.reason, alive: false, attempts: it.attempts + 1 },
      });
      await prisma.linkCheckState
        .update({
          where: { id: 'global' },
          data: { processedCount: { increment: 1 }, replacedCount: { increment: 1 }, currentItemId: null },
        })
        .catch(() => {});
      const post = await prisma.post.findUnique({ where: { id: it.postId } });
      if (post) {
        revalidatePath('/');
        revalidatePath(`/blog/${post.slug}`);
      }
      await this.log(`Lecserélve: "${it.postTitle}" → ${cand.title.slice(0, 80)} (${cand.price || 'ár nélkül'})`);
    }
  }
}

// Kandidát-rangsorolás heurisztikával (Gemini előtt):
// márka/modell szavak egyezése + ár-hasonlóság. A jóval olcsóbb találatok
// (kiegészítők, másik modell) hátrébb kerülnek.
function rankCandidates(
  list: AllegroSearchCandidate[],
  post: { productName: string | null; productBrand: string | null; title: string },
  oldPrice: number | null
): AllegroSearchCandidate[] {
  const nameText = normalizeForMatch([post.productName, post.productBrand].filter(Boolean).join(' '));
  const titleText = normalizeForMatch(post.title);
  const nameTokens = new Set(nameText.split(/\s+/).filter((w) => w.length >= 3));
  const titleTokens = new Set(titleText.split(/\s+/).filter((w) => w.length >= 4));
  const accessoryRe = /tok|fólia|folia|kábel|kabel|töltő|tolto|charger|case|cover|táp|adapter|csatlakozó|csatlakozo|állvány|allvany|tartó|tarto|kiegészítő|kiegeszito|accessory|hüvely|pánt|pant|párna|parna|kefé|kefe|tisztító|tisztito|védő|vedo/i;

  return list
    .map((c) => {
      const t = normalizeForMatch(c.title);
      let score = 0;
      for (const tok of nameTokens) if (t.includes(tok)) score += 1;
      for (const tok of titleTokens) if (t.includes(tok)) score += 0.5;
      if (accessoryRe.test(c.title)) score -= 2;
      const price = parseNumericPrice(c.price);
      if (oldPrice != null && price != null) {
        const ratio = price / oldPrice;
        if (ratio >= 0.45 && ratio <= 2.2) score += 1; // hasonló ár -> valószínűleg ugyanaz a termék
        else if (ratio < 0.3) score -= 2; // jóval olcsóbb -> valószínűleg kiegészítő/másik modell
      }
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

export function getLinkCheckWorker(): LinkCheckWorker {
  if (!g.__linkCheckWorker) g.__linkCheckWorker = new LinkCheckWorker();
  return g.__linkCheckWorker;
}