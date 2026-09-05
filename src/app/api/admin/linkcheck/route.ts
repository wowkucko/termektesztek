import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/linkcheck - állapot + link-ellenőrző lista
export async function GET() {
  const state = await prisma.linkCheckState.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global' },
  });
  const items = await prisma.linkCheckItem.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  });
  const counts = {
    active: await prisma.linkCheckItem.count({ where: { status: { in: ['QUEUED', 'CHECKING', 'SEARCHING', 'MATCHING'] } } }),
    ok: await prisma.linkCheckItem.count({ where: { status: 'OK' } }),
    replaced: await prisma.linkCheckItem.count({ where: { status: 'REPLACED' } }),
    notFound: await prisma.linkCheckItem.count({ where: { status: 'NOT_FOUND' } }),
    failed: await prisma.linkCheckItem.count({ where: { status: 'FAILED' } }),
  };
  const raw = process.env.LINKCHECK_SCHEDULE_ENABLED?.toLowerCase();
  const envDefault = raw === 'true' ? true : raw === 'false' ? false : process.env.NODE_ENV === 'production';
  const schedule = {
    intervalHours: parseInt(process.env.LINKCHECK_SCHEDULE_INTERVAL_HOURS || '168', 10) || 168,
    enabled: state.scheduleEnabled ?? envDefault, // a ténylegesen érvényes beállítás
    nextRunAt: state.nextRunAt,
  };
  return NextResponse.json({ state, items, counts, schedule });
}