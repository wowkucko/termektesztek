import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const raw = formData?.get('file');

  // Fájl-szerű ellenőrzés instanceof helyett: a `File` globális nem minden
  // Node-verzióban létezik, és a nem-böngésző kliensek (pl. push-script)
  // Blob-ot küldhetnek - azt is elfogadjuk.
  const file =
    raw && typeof raw === 'object' && typeof (raw as { arrayBuffer?: unknown }).arrayBuffer === 'function'
      ? (raw as unknown as { size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> })
      : null;

  if (!file) {
    return NextResponse.json({ error: 'Nincs feltöltött fájl.' }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: 'Nem támogatott fájltípus. Csak JPG, PNG, WEBP vagy GIF tölthető fel.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'A fájl mérete meghaladja a 8 MB-os korlátot.' }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  const filePath = path.join(uploadsDir, filename);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
