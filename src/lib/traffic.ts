import 'server-only';
import { prisma } from '@/lib/prisma';

// Napi forgalom-mérés: a két mérővégpont (view + affiliate kattintás) ide kerül.
// A nyers SQL-melegítés (UPDATE Post) helyett mindkettő UPSERT-eli az adott nap
// (UTC dátum) PostDailyStat sorát is, így az admin oldalon napi bontású grafikon
// mutathatja a forgalom alakulását.

// Mai nap UTC szerint, "YYYY-MM-DD" formában (PostDailyStat.day konvenció).
export function todayDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// View-rögzítés: növeli a Post.views összesítőt ÉS a mai napi sort.
// Nyers SQL az UPDATE-nél: a Prisma @updatedAt minden update()-nél frissülne,
// így a Post.updatedAt továbbra is a tényleges tartalmi módosítást jelzi.
export async function recordPostView(postId: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "Post" SET views = views + 1 WHERE id = ${postId}`;
  await upsertDailyStat(postId, 'views');
}

// Affiliate kattintás-rögzítés: növeli a Post.affiliateClicks összesítőt ÉS a
// mai napi sort. A cikken belüli MINDEN affiliate link ugyanígy számít
// (termékdoboz + oldalsáv — egynek számít, nem különböztetjük meg).
export async function recordPostAffiliateClick(postId: string): Promise<void> {
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
