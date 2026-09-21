import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Publikus végpont az affiliate (Allegro) kattintások rögzítésére. A cikkoldal
// inline scriptje hívja sendBeacon-nel (fire-and-forget: navigációkor is elküldi,
// és nem blokkolja a távoást). A cikken belül MINDEN affiliate link ugyanígy
// számít — termékdoboz, oldalsáv, stb. —, nem különböztetjük meg őket.
// A végpont nem jelenít meg publikus adatot, csak számol; a kiértékelés az
// admin /admin/statisztikak oldalon történik (auth-middleware védte).
export async function POST(request: Request) {
  try {
    // sendBeacon: Content-Type text/plain, a body kézzel parse-olandó
    const raw = await request.text();
    let body: { id?: unknown } | null = null;
    try {
      body = JSON.parse(raw) as { id?: unknown } | null;
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const id = body?.id;
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // Nyers SQL: ne bántja az updatedAt mezőt (ugyanaz a séma, mint a post-views-nál).
    await prisma.$executeRaw`UPDATE "Post" SET "affiliateClicks" = "affiliateClicks" + 1 WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    return NextResponse.json(
      { ok: false },
      { status: code === 'P2025' ? 404 : 500 }
    );
  }
}
