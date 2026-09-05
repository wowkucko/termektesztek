import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/admin/comments/[id] - komment törlése
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.comment.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'A komment nem található.' }, { status: 404 });
  }
}
