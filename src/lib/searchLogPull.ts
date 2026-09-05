import 'server-only';
import { prisma } from '@/lib/prisma';
import { getPushConfig } from '@/lib/pushToLive';

// Éles keresési napló LEHÚZÁSA itthonra (a push tükörképe).
// Az éles /kereses oldalt valódi látogatók használják, ezért az ő kereséseik
// a távoli DB-be naplózódnak - innen kerülnek át az itthoni naplóba, ahol a
// "Szinkronba" gomb már a helyi szinkronlistára dolgozik.
export async function pullSearchLogs(): Promise<{ pulled: number; prunedRemote: number; error?: string }> {
  const cfg = getPushConfig();
  if (!cfg) {
    return { pulled: 0, prunedRemote: 0, error: 'PUSH_TO / PUSH_EMAIL / PUSH_PASSWORD nincs beállítva.' };
  }

  let jar = '';
  const api = async (pathname: string, init?: { method?: string; json?: unknown }) => {
    const headers: Record<string, string> = {};
    if (jar) headers.cookie = jar;
    const res = await fetch(cfg.to + pathname, {
      method: init?.method || 'GET',
      headers: {
        ...headers,
        ...(init?.json !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const m = setCookie.match(/session=[^;]+/);
      if (m) jar = m[0];
    }
    return res;
  };

  const login = await api('/api/admin/auth/login', {
    method: 'POST',
    json: { email: cfg.email, password: cfg.password },
  });
  if (login.status !== 200) {
    return { pulled: 0, prunedRemote: 0, error: `Távoli login sikertelen (${login.status}).` };
  }

  const marker = await prisma.searchLogPull.findUnique({ where: { id: 'global' } });
  const since = marker?.pulledUntil || new Date(0);
  const exp = await api(`/api/admin/search-log/export?since=${encodeURIComponent(since.toISOString())}`);
  if (exp.status !== 200) {
    return { pulled: 0, prunedRemote: 0, error: `Export-hiba (${exp.status}).` };
  }
  const body = (await exp.json().catch(() => null)) as {
    rows?: { query: string; resultCount: number; createdAt: string }[];
    pruned?: number;
  } | null;
  const rows = Array.isArray(body?.rows) ? body.rows : [];

  let pulled = 0;
  let maxDate = since;
  for (const r of rows) {
    if (typeof r.query !== 'string' || !r.query) continue;
    const createdAt = new Date(r.createdAt);
    if (isNaN(createdAt.getTime())) continue;
    // Duplikátum-védelem (query + időpont): ismételt lehúzás nem dupláz
    const exists = await prisma.searchLog.findFirst({
      where: { query: r.query.slice(0, 120), createdAt },
      select: { id: true },
    });
    if (!exists) {
      await prisma.searchLog
        .create({ data: { query: r.query.slice(0, 120), resultCount: r.resultCount || 0, createdAt } })
        .catch(() => {});
      pulled++;
    }
    if (createdAt > maxDate) maxDate = createdAt;
  }

  await prisma.searchLogPull.upsert({
    where: { id: 'global' },
    update: { pulledUntil: maxDate },
    create: { id: 'global', pulledUntil: maxDate },
  });

  return { pulled, prunedRemote: body?.pruned ?? 0 };
}
