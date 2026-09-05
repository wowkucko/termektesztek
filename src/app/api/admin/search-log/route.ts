import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/admin/search-log - teljes keresési napló törlése
export async function DELETE() {
  await prisma.searchLog.deleteMany();
  return NextResponse.json({ ok: true });
}
