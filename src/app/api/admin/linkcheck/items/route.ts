import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/admin/linkcheck/items { action: "retry-failed" } - a FAILED tételek visszasorolása QUEUED-re
// (a próbálkozások száma nullázódik, hogy újra teljes MAX_ATTEMPTS álljon rendelkezésre)
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body?.action === 'retry-failed') {
    const res = await prisma.linkCheckItem.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'QUEUED', attempts: 0, lastError: null },
    });
    return NextResponse.json({ ok: true, requeued: res.count });
  }
  return NextResponse.json({ error: 'Ismeretlen action. (retry-failed)' }, { status: 400 });
}

// DELETE /api/admin/linkcheck/items?id=... - egy tétel eltávolítása
// DELETE /api/admin/linkcheck/items?all=failed|notfound|done - csoportos törlés
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all');

  if (id) {
    const item = await prisma.linkCheckItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'A tétel nem található.' }, { status: 404 });
    await prisma.linkCheckItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (all === 'failed' || all === 'notfound' || all === 'done') {
    const status = all === 'done' ? 'REPLACED' : all === 'notfound' ? 'NOT_FOUND' : 'FAILED';
    const res = await prisma.linkCheckItem.deleteMany({ where: { status } });
    return NextResponse.json({ ok: true, deleted: res.count });
  }

  return NextResponse.json({ error: 'Add meg az id-t vagy a all=failed/notfound/done paramétert.' }, { status: 400 });
}