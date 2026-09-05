import Image from 'next/image';
import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';

// Méret-gyorsítótár: a feltöltött képek tartalma nem változik, így elég egyszer lekérdezni.
const dimCache = new Map<string, { w: number; h: number }>();

async function getLocalDimensions(src: string): Promise<{ w: number; h: number } | null> {
  const cached = dimCache.get(src);
  if (cached) return cached;
  try {
    const filePath = path.join(process.cwd(), 'public', src.replace(/^\//, ''));
    await fs.access(filePath);
    const meta = await sharp(filePath).metadata();
    if (meta.width && meta.height) {
      dimCache.set(src, { w: meta.width, h: meta.height });
      return { w: meta.width, h: meta.height };
    }
  } catch {
    // nem lokális / nem elérhető - sima img-re esünk vissza
  }
  return null;
}

// A cikk-markdown képeit next/image-dzsel rendereljük: méret-becslés (CLS elkerülése),
// lazy betöltés, és a sharp a display méretre optimalizálja a fájlt (a 2560px-es
// eredeti helyett a tényleges megjelenítési méret megy le a hálózaton).
export default async function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const imageSrc = src || '';
  const imageAlt = alt || '';
  if (imageSrc.startsWith('/uploads/') || imageSrc.startsWith('/')) {
    const dims = await getLocalDimensions(imageSrc);
    if (dims) {
      return (
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={dims.w}
          height={dims.h}
          sizes="(min-width: 1024px) 720px, 92vw"
          loading="lazy"
          decoding="async"
          className="mx-auto h-auto max-w-full rounded-card"
        />
      );
    }
  }
  // Külső vagy ismeretlen kép: sima, de lazily betöltött img
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageSrc} alt={imageAlt} loading="lazy" decoding="async" />;
}