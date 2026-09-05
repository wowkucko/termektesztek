import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Publikus végpont a cikk-megtekintések növelésére (a cikkoldal inline
// scriptje hívja betöltéskor — így az oldalnak nincs saját kliens komponense)
// hívja). A számláló nem jelenik meg publikus helyen, így a spam nem okoz kárt.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    const id = body?.id;
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // Nyers SQL: a views növelése NEM bántja az updatedAt mezőt (a Prisma
    // @updatedAt minden update()-nél frissülne). Így az updatedAt továbbra is
    // a tényleges tartalmi módosítást jelzi - ezt mutatjuk "Frissítve" dátumként.
    await prisma.$executeRaw`UPDATE "Post" SET views = views + 1 WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Nem létező/eltávolított cikk id-ja (P2025): nincs mit számolni, nem hiba.
    const code = (e as { code?: string } | null)?.code;
    return NextResponse.json(
      { ok: false },
      { status: code === 'P2025' ? 404 : 500 }
    );
  }
}
