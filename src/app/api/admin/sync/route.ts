import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const addSchema = z.object({
  names: z.array(z.string().min(2, 'A terméknév legalább 2 karakter legyen.')).min(1, 'Adj meg legalább egy terméknév.').max(100),
});

// GET /api/admin/sync - állapot + termékek listája
export async function GET() {
  const state = await prisma.syncState.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global' },
  });
  const items = await prisma.syncProduct.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  });
  const counts = {
    queued: await prisma.syncProduct.count({ where: { status: 'QUEUED' } }),
    done: await prisma.syncProduct.count({ where: { status: 'DONE' } }),
    failed: await prisma.syncProduct.count({ where: { status: 'FAILED' } }),
  };
  return NextResponse.json({ state, items, counts });
}

// POST /api/admin/sync - termékek hozzáadása (batch)
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Érvénytelen adatok.' }, { status: 400 });
  }
  const added = [];
  for (const raw of parsed.data.names) {
    const name = raw.trim();
    if (!name) continue;
    // duplikátum: ugyanaz a név QUEUED/DONE státuszban
    const existing = await prisma.syncProduct.findFirst({
      where: { name, status: { in: ['QUEUED', 'SCRAPING', 'GENERATING', 'DONE'] } },
    });
    if (existing) continue;
    const item = await prisma.syncProduct.create({ data: { name } });
    added.push(item);
  }
  return NextResponse.json({ ok: true, added: added.length }, { status: 201 });
}
