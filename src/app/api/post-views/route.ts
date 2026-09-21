import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordPostView } from '@/lib/traffic';

// Publikus végpont a cikk-megtekintések növelésére (a cikkoldal inline
// scriptje hívja betöltéskor — így az oldalnak nincs saját kliens komponense).
// A számláló nem jelenik meg publikus helyen, így a spam nem okoz kárt.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    const id = body?.id;
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await recordPostView(request, id);
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
