import { NextRequest, NextResponse } from 'next/server';
import { getPushConfig, getPendingPosts, pushPostsToLive } from '@/lib/pushToLive';
import { prisma } from '@/lib/prisma';

// GET /api/admin/push - állapot: konfigurálva van-e, mi vár feltöltésre
export async function GET() {
  const cfg = getPushConfig();
  const pending = await getPendingPosts(100);
  const pushedCount = await prisma.pushRecord.count();
  const recent = await prisma.pushRecord.findMany({
    orderBy: { pushedAt: 'desc' },
    take: 10,
  });
  return NextResponse.json({
    configured: !!cfg,
    to: cfg?.to || null,
    pendingCount: pending.length,
    pending: pending.slice(0, 20).map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category.name,
      publishedAt: p.publishedAt,
    })),
    pushedCount,
    recent: recent.map((r) => ({ postSlug: r.postSlug, remoteSlug: r.remoteSlug, pushedAt: r.pushedAt })),
  });
}

// POST /api/admin/push { slugs?: string[], limit?: number } - feltöltés indítása.
// Szinkron fut le (több perc is lehet sok képnél) - csak admin hívhatja.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((s: unknown) => typeof s === 'string') : undefined;
  const limit =
    typeof body?.limit === 'number' && body.limit > 0 && body.limit <= 50 ? Math.floor(body.limit) : 10;
  const report = await pushPostsToLive({ slugs, limit });
  return NextResponse.json({ ok: report.errors.length === 0, ...report });
}
