import 'server-only';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

// Szerveroldali "Push to live": az itthon legenerált cikkek feltöltése a
// TÁVOLI (éles) blogra az adminból, egyetlen gombnyomásra.
// Cél + belépés a .env-ből: PUSH_TO, PUSH_EMAIL, PUSH_PASSWORD.
// (A scripts/push-posts.mjs CLI ugyanezt tudja parancssorból.)

export type PushConfig = { to: string; email: string; password: string };

export function getPushConfig(): PushConfig | null {
  const to = (process.env.PUSH_TO || '').trim().replace(/\/$/, '');
  const email = (process.env.PUSH_EMAIL || '').trim();
  const password = process.env.PUSH_PASSWORD || '';
  if (!to || !email || !password) return null;
  return { to, email, password };
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function localFilesIn(content: string | null, ...extra: Array<string | null>): string[] {
  const found = new Set<string>();
  const all = [content, ...extra].filter((t): t is string => typeof t === 'string');
  for (const t of all) {
    const re = /\((\/uploads\/[^)\s"']+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) found.add(m[1]);
    // cover/og: önálló helyi útvonal is lehet
    if (t.startsWith('/') && !t.startsWith('//')) found.add(t.split(/[?#]/)[0]);
  }
  return [...found];
}

function safeParseArray(v: string | null): string[] {
  try {
    const a = JSON.parse(v || '[]');
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export type PushReport = {
  pushed: { localSlug: string; remoteSlug: string; url: string }[];
  skipped: string[];
  errors: string[];
};

export async function getPendingPosts(limit = 50) {
  const pushed = await prisma.pushRecord.findMany({ select: { postSlug: true } });
  const pushedSet = new Set(pushed.map((p) => p.postSlug));
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    include: { category: true },
    orderBy: { publishedAt: 'asc' },
    take: 500,
  });
  return posts.filter((p) => !pushedSet.has(p.slug)).slice(0, limit);
}

export async function pushPostsToLive(opts: {
  slugs?: string[];
  limit?: number;
}): Promise<PushReport> {
  const report: PushReport = { pushed: [], skipped: [], errors: [] };
  const cfg = getPushConfig();
  if (!cfg) {
    report.errors.push('PUSH_TO / PUSH_EMAIL / PUSH_PASSWORD nincs beállítva a .env fájlban.');
    return report;
  }

  // --- session-kezelés a távoli oldalon ---
  let jar = '';
  const api = async (pathname: string, init?: { method?: string; json?: unknown; form?: FormData }) => {
    const headers: Record<string, string> = {};
    if (jar) headers.cookie = jar;
    let body: BodyInit | undefined;
    if (init?.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(init.json);
    } else if (init?.form) {
      body = init.form;
    }
    const res = await fetch(cfg.to + pathname, { method: init?.method || 'GET', headers, body });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const m = setCookie.match(/session=[^;]+/);
      if (m) jar = m[0];
    }
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* nem JSON */
    }
    return { status: res.status, data: data as Record<string, unknown> | null, text };
  };

  const login = await api('/api/admin/auth/login', {
    method: 'POST',
    json: { email: cfg.email, password: cfg.password },
  });
  if (login.status !== 200) {
    report.errors.push(`Távoli login sikertelen (${login.status}): ${login.text.slice(0, 150)}`);
    return report;
  }

  // --- pusholandó cikkek ---
  const pushed = await prisma.pushRecord.findMany({ select: { postSlug: true } });
  const pushedSet = new Set(pushed.map((p) => p.postSlug));
  let posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      ...(opts.slugs && opts.slugs.length > 0 ? { slug: { in: opts.slugs } } : {}),
    },
    include: { category: true, tags: { include: { tag: true } } },
    orderBy: { publishedAt: 'asc' },
    take: 500,
  });
  if (!opts.slugs) posts = posts.filter((p) => !pushedSet.has(p.slug));
  if (opts.limit) posts = posts.slice(0, opts.limit);
  if (posts.length === 0) {
    report.skipped.push('Nincs feltöltendő cikk (minden publikált már fenn van).');
    return report;
  }

  // --- kategóriák biztosítása távol (slug alapján; a duplikátum-400-at elfogadjuk) ---
  const cats = new Map(posts.map((p) => [p.category.slug, p.category]));
  for (const c of cats.values()) {
    const r = await api('/api/admin/categories', {
      method: 'POST',
      json: { name: c.name, slug: c.slug, description: c.description },
    });
    if (r.status !== 201 && r.status !== 400) {
      report.errors.push(`Kategória-hiba ${c.slug}: ${r.status} ${r.text.slice(0, 120)}`);
      return report;
    }
  }

  // --- cikkenként: képek, majd POST ---
  for (const p of posts) {
    const files = localFilesIn(p.content, p.coverImage, p.ogImage);
    const urlMap: Record<string, string> = {};
    let failed = false;
    for (const local of files) {
      const known = await prisma.pushFile.findUnique({ where: { localPath: local } });
      if (known) {
        urlMap[local] = known.remoteUrl;
        continue;
      }
      const abs = path.join(process.cwd(), 'public', local);
      if (!existsSync(abs)) {
        report.errors.push(`[${p.slug}] hiányzó kép, kihagyva: ${local}`);
        failed = true;
        break;
      }
      const ext = path.extname(local).toLowerCase();
      const buf = await readFile(abs);
      const form = new FormData();
      const blob =
        typeof File !== 'undefined'
          ? new File([buf], path.basename(local), { type: MIME[ext] || 'image/jpeg' })
          : new Blob([buf], { type: MIME[ext] || 'image/jpeg' });
      form.append('file', blob, path.basename(local));
      const up = await api('/api/admin/upload', { method: 'POST', form });
      const url = typeof up.data?.url === 'string' ? up.data.url : null;
      if (up.status !== 200 || !url) {
        report.errors.push(`[${p.slug}] képfeltöltés-hiba ${local}: ${up.status}`);
        failed = true;
        break;
      }
      urlMap[local] = url;
      await prisma.pushFile.create({ data: { localPath: local, remoteUrl: url } }).catch(() => {});
    }
    if (failed) continue;

    const rewrite = (t: string | null) => {
      if (typeof t !== 'string') return t;
      let out = t;
      for (const [from, to] of Object.entries(urlMap)) out = out.split(from).join(to);
      return out;
    };
    const r = await api('/api/admin/posts', {
      method: 'POST',
      json: {
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: rewrite(p.content),
        coverImage: rewrite(p.coverImage),
        coverImageAlt: p.coverImageAlt,
        categorySlug: p.category.slug,
        tags: p.tags.map((t) => t.tag.name),
        status: 'PUBLISHED',
        productName: p.productName,
        productBrand: p.productBrand,
        priceFt: p.priceFt,
        rating: p.rating,
        pros: safeParseArray(p.pros),
        cons: safeParseArray(p.cons),
        verdict: p.verdict,
        affiliateUrl: p.affiliateUrl,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        ogImage: rewrite(p.ogImage),
      },
    });
    if (r.status !== 201 || !r.data?.ok || typeof r.data.slug !== 'string') {
      report.errors.push(`[${p.slug}] cikk-hiba: ${r.status} ${r.text.slice(0, 150)}`);
      continue;
    }
    await prisma.pushRecord
      .upsert({
        where: { postSlug: p.slug },
        update: { remoteSlug: r.data.slug, pushedAt: new Date() },
        create: { postSlug: p.slug, remoteSlug: r.data.slug },
      })
      .catch(() => {});
    report.pushed.push({ localSlug: p.slug, remoteSlug: r.data.slug, url: `${cfg.to}/blog/${r.data.slug}` });
  }

  return report;
}
