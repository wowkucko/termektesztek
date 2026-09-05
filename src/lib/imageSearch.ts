import 'server-only';

// DuckDuckGo képkeresés a vqd token kinyerésével, majd az i.js JSON API hívással.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function getVqd(query: string): Promise<string> {
  const res = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers: { 'User-Agent': UA },
  });
  const html = await res.text();
  const m = html.match(/vqd=["']?([\d-]+)["']?/) || html.match(/vqd=([\d-]+)&/);
  if (!m) throw new Error('Nem sikerült a DDG vqd token kinyerése.');
  return m[1];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Egy DDG képkeresés (vqd + i.js). A DDG időnként átmenetileg rate-limitel (429/anomaly),
// ezért a hívó oldalon újrapróbálkozunk kis várakozással.
async function searchImagesOnce(query: string, count: number): Promise<{ url: string; width: number; height: number; source?: string }[]> {
  const vqd = await getVqd(query);
  const res = await fetch(
    `https://duckduckgo.com/i.js?l=hu-hu&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`,
    { headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/', Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`DDG image API hiba: ${res.status}`);
  const j = (await res.json()) as { results?: { image: string; width: number; height: number; source?: string }[] };
  return (j.results || [])
    .filter((r) => r.width >= 400 && r.height >= 300)
    .slice(0, count)
    .map((r) => ({ url: r.image, width: r.width, height: r.height, source: r.source }));
}

// Rate-limit esetén (429 / gyors hiba) újrapróbálkozás rövid backoff-fal.
export async function searchImages(query: string, count = 6): Promise<{ url: string; width: number; height: number; source?: string }[]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await searchImagesOnce(query, count);
    } catch (e) {
      lastErr = e;
      if (attempt === 1) await sleep(8000); // rövid szünet a rate-limit elkerülésére
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Kép letöltése és mentése a /public/uploads mappába. Visszaadja a lokális URL-t.
export async function downloadImage(imageUrl: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(imageUrl, { headers: { 'User-Agent': UA }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = ALLOWED_EXT[ct];
    if (!ext) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000 || buf.length > 8 * 1024 * 1024) return null; // min 5KB, max 8MB

    const { randomUUID } = await import('crypto');
    const { writeFile, mkdir } = await import('fs/promises');
    const path = await import('path');

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const filename = `sync-${randomUUID()}.${ext}`;
    await writeFile(path.join(uploadsDir, filename), buf);
    return `/uploads/${filename}`;
  } catch {
    return null;
  }
}

// Keres + letölt egy borítóképet, több próbálkozással.
export async function findAndDownloadCoverImage(query: string, fallbackQueries: string[] = []): Promise<string | null> {
  const queries = [query, ...fallbackQueries];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(600);
    try {
      const results = await searchImages(queries[i], 5);
      for (const img of results) {
        const local = await downloadImage(img.url);
        if (local) return local;
      }
    } catch {
      // következő query
    }
  }
  return null;
}
