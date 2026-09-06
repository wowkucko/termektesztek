import { NextRequest, NextResponse } from 'next/server';
import { getPushConfig, getPendingPosts, getUpdatedPosts, pushPostsToLive, pushUpdatesToLive } from '@/lib/pushToLive';
import { prisma } from '@/lib/prisma';

// GET /api/admin/push - állapot: konfigurálva van-e, mi vár feltöltésre/frissítésre
export async function GET() {
  const cfg = getPushConfig();
  const pending = await getPendingPosts(100);
  const updated = await getUpdatedPosts(100);
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
    updatedCount: updated.length,
    updated: updated.slice(0, 20).map(({ post }) => ({
      slug: post.slug,
      title: post.title,
      updatedAt: post.updatedAt,
    })),
    pushedCount,
    recent: recent.map((r) => ({ postSlug: r.postSlug, remoteSlug: r.remoteSlug, pushedAt: r.pushedAt })),
  });
}

// POST /api/admin/push { slugs?: string[], limit?: number, kind?: 'new' | 'updates' | 'restart' }
// kind=new: még fel nem töltött cikkek; kind=updates: itthon módosultak frissítése;
// kind=restart: távoli szerver újraindítása (új képek után kell, különben 404-et adnak).
// Szinkron fut le (több perc is lehet sok képnél) - csak admin hívhatja.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body?.kind === 'restart') {
    const cfg = getPushConfig();
    if (!cfg) return NextResponse.json({ ok: false, error: 'PUSH config hiányzik.' }, { status: 400 });
    let jar = '';
    const login = await fetch(cfg.to + '/api/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: cfg.email, password: cfg.password }),
    });
    if (login.status !== 200) {
      return NextResponse.json({ ok: false, error: 'Távoli login sikertelen.' }, { status: 400 });
    }
    const setCookie = login.headers.get('set-cookie');
    const m = setCookie?.match(/session=[^;]+/);
    if (m) jar = m[0];
    const rs = await fetch(cfg.to + '/api/admin/system/restart', {
      method: 'POST',
      headers: jar ? { cookie: jar } : {},
    });
    const ok = rs.status === 200;
    return NextResponse.json({
      ok,
      pushed: [],
      errors: ok ? [] : ['Az éles újraindítás nem sikerült (frissítsd a kódot élesen update-scripttel).'],
    });
  }
  const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((s: unknown) => typeof s === 'string') : undefined;
  const limit =
    typeof body?.limit === 'number' && body.limit > 0 && body.limit <= 50 ? Math.floor(body.limit) : 10;
  const report =
    body?.kind === 'updates'
      ? await pushUpdatesToLive({ slugs, limit })
      : await pushPostsToLive({ slugs, limit });
  return NextResponse.json({ ok: report.errors.length === 0, ...report });
}
