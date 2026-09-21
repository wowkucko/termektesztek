import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

// Napi forgalom-mérés + bot-védelem: a két mérővégpont (view + affiliate
// kattintás) ide kerül. A nyers SQL-melegítés (UPDATE Post) helyett mindkettő
// UPSERT-eli az adott nap (UTC dátum) PostDailyStat sorát is, így az admin
// oldalon napi bontású grafikon mutathatja a forgalom alakulását.
//
// Bot-védelem (TrafficGuard):
//  1. Robot user-agent (bot, crawler, spider, headless...) → nem számol.
//  2. Dedup: azonos IP + cikk + jel típusa rövid TTL-en belül csak egyszer
//     számol (újratöltés, gyors visszalépés-visszatérés). A TTL rövid, mert a
//     cellás mobilhálózatokon SOK valódi olvasó osztozik egy IP-n — a hosszú
//     TTL ott valódi olvasokat veszítene el.
//  3. Flood-plafon: egy IP adott napon max. N új cikket "nyithat meg"; efölött
//     a továbbiak nem számolnak (scraper / klikk-automata ellen), a már
//     megszámolt cikkek visszatérése továbbra is deduplikáltan MEGSZÁMOL.
//  4. Az IP sosem tárolódik nyersen: sha256(napi só + IP) kerül mentésre —
//     pseudonymizálás (GDPR), a napi só miatt visszamenőleg sem követhető.
//     A guard-sorok lejártkor törölődnek.
//
// A számolás "hit-alapú": a kérés vagy teljesen eldobja (bot, duplikátum,
// flood), vagy teljesen megszámolja (Post összesítő + napi sor). Nincs félig
// számolt állapot.

// Robot user-agent jelek (kisbetűs egyezés, részszóra).
const BOT_UA_PATTERNS = [
  'bot', 'crawl', 'spider', 'slurp', 'bingpreview', 'lighthouse',
  'headless', 'phantomjs', 'puppeteer', 'playwright', 'curl', 'wget',
  'python-requests', 'java/', 'httpclient', 'monitor', 'uptime',
  'facebookexternalhit', 'embedly', 'preview',
];

// TTL-ek: rövidek, mert megosztott IP-k (mobilhálózat, cég, iskola) miatt a
// hosszú zárolás valódi olvasokat zárná ki. A kliensoldali sessionStorage
// (lásd a cikkoldal scriptjét) fogja a hotlanmaradó reload-okat elnyelni.
const VIEW_DEDUP_TTL_HOURS = 6;
const CLICK_DEDUP_TTL_HOURS = 24;
// Egy IP napi "új cikk" plafonja (flood/scraper ellen).
const DAILY_NEW_IP_LIMIT = 25;
// Guard-tábla takarítás: átlagosan ennyi kérésenként fut le (olcsó, indexelt).
const CLEANUP_SAMPLE = 50;

export function isBotUserAgent(ua: string): boolean {
  const uaLower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => uaLower.includes(p));
}

// Reális kliens-IP: proxy/CDN mögött az x-forwarded-for első eleme.
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

type HitKind = 'view' | 'click';

// A teljes guard-folyamat. true = számoljunk, false = eldobandó.
async function shouldCountHit(request: Request, postId: string, kind: HitKind): Promise<boolean> {
  const ua = request.headers.get('user-agent') || '';
  if (!ua || isBotUserAgent(ua)) return false;

  const day = new Date().toISOString().slice(0, 10);
  const ip = getClientIp(request);
  const ipHash = sha256(`traffic-v1:${day}:${ip}`);

  // 1) Flood-plafon: hány ÚJ cikket "nyitott meg" ma ez az IP? (view-k esetén)
  //    A már ismert cikkekre érkező jel mindig továbbmehet a deduphoz.
  if (kind === 'view') {
    const seen = await prisma.trafficGuard.count({
      where: { key: { startsWith: `flood:${ipHash}:` } },
    });
    const known = await prisma.trafficGuard.findUnique({
      where: { key: `hit:${ipHash}:${postId}:view` },
    });
    if (!known && seen >= DAILY_NEW_IP_LIMIT) return false;
  }

  // 2) Dedup: azonos IP + cikk + fajta a TTL-en belül csak egyszer számol.
  const ttlHours = kind === 'view' ? VIEW_DEDUP_TTL_HOURS : CLICK_DEDUP_TTL_HOURS;
  const dedupKey = `hit:${ipHash}:${postId}:${kind}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 3600_000);
  try {
    await prisma.trafficGuard.create({ data: { key: dedupKey, expiresAt } });
  } catch {
    // Már létezik (P2002) → duplikátum, nem számol.
    return false;
  }

  // 3) Flood-számláló: az első (megszámolt) view "nyitja" a cikket az IP-nek.
  if (kind === 'view') {
    await prisma.trafficGuard
      .create({ data: { key: `flood:${ipHash}:${postId}`, expiresAt: new Date(now.getTime() + 86400_000) } })
      .catch(() => undefined); // már nyitott cikk → nem új, a számláló nem változik
  }

  // 4) Ritka takarítás: lejárt guard-sorok törlése (indexelt expiresAt).
  if (Math.random() < 1 / CLEANUP_SAMPLE) {
    prisma.trafficGuard.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => undefined);
  }

  return true;
}

// Mai nap UTC szerint, "YYYY-MM-DD" formában (PostDailyStat.day konvenció).
export function todayDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// View-rögzítés (guard + Post összesítő + napi sor).
// Nyers SQL az UPDATE-nél: a Prisma @updatedAt minden update()-nél frissülne,
// így a Post.updatedAt továbbra is a tényleges tartalmi módosítást jelzi.
export async function recordPostView(request: Request, postId: string): Promise<void> {
  if (!(await shouldCountHit(request, postId, 'view'))) return;
  await prisma.$executeRaw`UPDATE "Post" SET views = views + 1 WHERE id = ${postId}`;
  await upsertDailyStat(postId, 'views');
}

// Affiliate kattintás-rögzítés (guard + Post összesítő + napi sor).
// A cikken belüli MINDEN affiliate link ugyanígy számít (termékdoboz +
// oldalsáv — egynek számít, nem különböztetjük meg).
export async function recordPostAffiliateClick(request: Request, postId: string): Promise<void> {
  if (!(await shouldCountHit(request, postId, 'click'))) return;
  await prisma.$executeRaw`UPDATE "Post" SET "affiliateClicks" = "affiliateClicks" + 1 WHERE id = ${postId}`;
  await upsertDailyStat(postId, 'affiliateClicks');
}

// Napi sor upsert: csak a kért mezőt növeli, a másikat érintetlenül hagyja.
async function upsertDailyStat(
  postId: string,
  field: 'views' | 'affiliateClicks'
): Promise<void> {
  const day = todayDayKey();
  try {
    await prisma.postDailyStat.upsert({
      where: { postId_day: { postId, day } },
      create: { postId, day, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  } catch {
    // Párhuzamos first-write (ritka): a második upsert P2002-t dobhat a
    // create ágon — ilyenkor egy frissítéssel megpróbáljuk mégis elmenteni.
    try {
      await prisma.postDailyStat.update({
        where: { postId_day: { postId, day } },
        data: { [field]: { increment: 1 } },
      });
    } catch {
      // A cikk időközben törölve (P2025): nincs mit számolni.
    }
  }
}

export type DailyTrafficPoint = {
  day: string; // "YYYY-MM-DD"
  views: number;
  clicks: number;
};

// Utolsó `days` nap napi összesített forgalma (minden publikált cikk), a
// legrégebbiből a legfrissebbe rendezve. Üres napok (nincs forgalom) 0-val
// szerepelnek, hogy a grafikon x-tengelye folytonos legyen.
export async function getDailyTraffic(days = 30): Promise<DailyTrafficPoint[]> {
  const points: DailyTrafficPoint[] = [];
  const today = new Date();
  const dayKeys = new Set<string>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = todayDayKey(d);
    dayKeys.add(key);
    points.push({ day: key, views: 0, clicks: 0 });
  }
  const byIndex = new Map(points.map((p, i) => [p.day, i]));

  const rows = await prisma.postDailyStat.groupBy({
    by: ['day'],
    _sum: { views: true, affiliateClicks: true },
    where: { day: { in: [...dayKeys] } },
  });

  for (const row of rows) {
    const idx = byIndex.get(row.day);
    if (idx == null) continue;
    points[idx].views = row._sum.views ?? 0;
    points[idx].clicks = row._sum.affiliateClicks ?? 0;
  }

  return points;
}

export type TopTrafficPost = {
  id: string;
  slug: string;
  title: string;
  category: string;
  views: number;
  clicks: number;
  sharePct: number; // részesedés a 30 napos összes view-ból (0-100)
};

// Az utolsó `days` nap legtöbbet nézett cikkei (a napi statisztikából
// összesítve) + az időszak teljes view-száma a részarányhoz. Csak a napi
// mérésbe bekerülő forgalmat látja — a séma-bevezetés előtti történetet nem.
export async function getTopPostsLastDays(
  days = 30,
  limit = 5
): Promise<{ totalViews: number; items: TopTrafficPost[] }> {
  const today = new Date();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dayKeys.push(todayDayKey(new Date(today.getTime() - i * 86400000)));
  }

  const groups = await prisma.postDailyStat.groupBy({
    by: ['postId'],
    _sum: { views: true, affiliateClicks: true },
    where: { day: { in: dayKeys } },
    orderBy: { _sum: { views: 'desc' } },
  });

  const totalViews = groups.reduce((s, g) => s + (g._sum.views ?? 0), 0);
  const top = groups.filter((g) => (g._sum.views ?? 0) > 0).slice(0, limit);
  if (top.length === 0) return { totalViews: 0, items: [] };

  const posts = await prisma.post.findMany({
    where: { id: { in: top.map((g) => g.postId) } },
    select: { id: true, slug: true, title: true, category: { select: { name: true } } },
  });
  const byId = new Map(posts.map((p) => [p.id, p]));

  const items = top
    .map((g) => {
      const post = byId.get(g.postId);
      if (!post) return null; // a cikk időközben törölve
      const views = g._sum.views ?? 0;
      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        category: post.category.name,
        views,
        clicks: g._sum.affiliateClicks ?? 0,
        sharePct: totalViews > 0 ? (views / totalViews) * 100 : 0,
      };
    })
    .filter((x): x is TopTrafficPost => x != null);

  return { totalViews, items };
}
