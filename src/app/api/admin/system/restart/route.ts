import { NextResponse } from 'next/server';

// POST /api/admin/system/restart - a Node-processz leállítása; a PM2
// automatikusan újraindítja. CSAK productionben engedélyezett (a dev
// szervert nem felügyeli senki, azt nem szabad kilőni)!
// Használat: push után, ha új képfájlok kerültek fel - a production
// Next.js csak újraindítás után szolgálja ki az indulása után írt
// public-fájlokat (reprodukált viselkedés).
export async function POST() {
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json(
      { error: 'Csak éles (production) módban engedélyezett.' },
      { status: 400 }
    );
  }
  // Válaszoljunk előbb, aztán lépjünk ki - a PM2 újraéleszt.
  setTimeout(() => process.exit(0), 800);
  return NextResponse.json({ ok: true, message: 'Újraindítás...' });
}
