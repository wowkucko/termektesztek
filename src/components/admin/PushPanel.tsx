'use client';

import { useCallback, useEffect, useState } from 'react';

type PendingPost = { slug: string; title: string; category: string; publishedAt: string | null };
type PushedItem = { localSlug: string; remoteSlug: string; url: string };

type PushStatus = {
  configured: boolean;
  to: string | null;
  pendingCount: number;
  pending: PendingPost[];
  updatedCount: number;
  updated: { slug: string; title: string; updatedAt: string }[];
  pushedCount: number;
  recent: { postSlug: string; remoteSlug: string; pushedAt: string }[];
};

export default function PushPanel() {
  const [data, setData] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ pushed: PushedItem[]; errors: string[]; restartNeeded?: boolean } | null>(null);
  const [restarting, setRestarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/push');
      setData(await r.json());
    } catch {
      // következő poll próbálkozik
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const push = async (slugs?: string[], kind?: 'updates') => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slugs ? { slugs } : { limit: 10, ...(kind ? { kind } : {}) }),
      });
      const j = await res.json();
      setResult({ pushed: j.pushed || [], errors: j.errors || [], restartNeeded: j.restartNeeded });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const restartRemote = async () => {
    if (!confirm('Újraindítod az éles szervert? Kb. fél percre leáll az oldal, a PM2 automatikusan újraéleszti.')) return;
    setRestarting(true);
    try {
      await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'restart' }),
      }).catch(() => {});
      setResult((r) => (r ? { ...r, restartNeeded: false } : r));
    } finally {
      setRestarting(false);
    }
  };

  if (!data) {
    return <p className="font-body text-sm text-ink/60">Betöltés…</p>;
  }

  if (!data.configured) {
    return (
      <div className="rounded-card border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-display text-lg font-bold text-ink">Push to live nincs beállítva</h2>
        <p className="mt-2 font-body text-sm leading-relaxed text-ink/70">
          Add meg a <code>.env</code> fájlban a távoli blog adatait, majd indítsd újra a szervert:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-tight bg-ink p-3 font-mono text-xs text-white/80">
          {`PUSH_TO=https://teblogod.hu\nPUSH_EMAIL=admin@teblogod.hu\nPUSH_PASSWORD=...`}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold text-ink">Feltöltés élesre</h2>
        <p className="mt-1 font-body text-sm text-ink/50">
          Cél: <span className="font-medium text-teal-700">{data.to}</span> · Eddig feltöltve:{' '}
          {data.pushedCount} cikk · Hátralévő: {data.pendingCount} cikk
        </p>
        <button onClick={() => push()} disabled={busy || data.pendingCount === 0} className="btn-primary mt-4 disabled:opacity-40">
          {busy ? '⟳ Feltöltés folyamatban…' : `⬆ ${Math.min(data.pendingCount, 10)} cikk feltöltése`}
        </button>
        {busy && (
          <p className="mt-2 font-sans text-xs text-ink/45">
            Képek feltöltése miatt ez több percig is tarthat — ne zárd be az oldalt.
          </p>
        )}
      </div>

      {result && (
        <div className="rounded-card border border-line bg-white p-5">
          <h3 className="font-display text-base font-bold text-ink">Eredmény</h3>
          {result.restartNeeded && (
            <div className="mt-2 rounded-tight border border-amber-200 bg-amber-50 p-3">
              <p className="font-sans text-sm text-amber-800">
                Új képek kerültek fel — az éles szerver csak újraindítás után szolgálja ki őket.
              </p>
              <button
                onClick={restartRemote}
                disabled={restarting}
                className="btn-secondary mt-2 disabled:opacity-40"
              >
                {restarting ? '⟳ Újraindítás…' : '🔄 Éles szerver újraindítása'}
              </button>
            </div>
          )}
          {result.pushed.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.pushed.map((p) => (
                <li key={p.localSlug} className="font-sans text-sm">
                  <span className="text-pro">✓</span>{' '}
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                    {p.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="font-sans text-sm text-red-600">
                    {e}
                  </li>
              ))}
            </ul>
          )}
          {result.pushed.length === 0 && result.errors.length === 0 && (
            <p className="mt-2 font-sans text-sm text-ink/60">Nincs új feltöltendő cikk.</p>
          )}
        </div>
      )}

      {data.updatedCount > 0 && (
        <div className="rounded-card border border-blue-200 bg-blue-50/50 p-5">
          <h2 className="font-display text-lg font-bold text-ink">Élesen frissítendő módosulások</h2>
          <p className="mt-1 font-body text-sm text-ink/55">
            {data.updatedCount} már feltöltött cikk itthon megváltozott (pl. a link-ellenőrző
            lecserélte a vásárlási linket, vagy szerkesztetted). A frissítés felülírja az éles
            tartalmat, az ottani hozzászólások megmaradnak.
          </p>
          <ul className="mt-2 space-y-1">
            {data.updated.slice(0, 8).map((u) => (
              <li key={u.slug} className="font-sans text-sm text-ink/75">
                {u.title}{' '}
                <span className="text-xs text-ink/40">
                  · módosítva: {new Date(u.updatedAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => push(undefined, 'updates')}
            disabled={busy}
            className="btn-secondary mt-4 disabled:opacity-40"
          >
            {busy ? '⟳ Frissítés folyamatban…' : `🔄 ${Math.min(data.updatedCount, 10)} módosult cikk frissítése`}
          </button>
        </div>
      )}

      {data.pending.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink">Feltöltésre váró cikkek</h2>
          </div>
          <ul className="divide-y divide-line">
            {data.pending.map((p) => (
              <li key={p.slug} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-sm font-medium text-ink">{p.title}</p>
                  <p className="font-sans text-xs text-ink/45">{p.category}</p>
                </div>
                <button
                  onClick={() => push([p.slug])}
                  disabled={busy}
                  className="font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40 font-sans text-sm"
                >
                  ⬆ Feltöltés
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recent.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink">Legutóbb feltöltve</h2>
          </div>
          <ul className="divide-y divide-line">
            {data.recent.map((r) => (
              <li key={r.postSlug} className="px-5 py-2.5 font-sans text-sm text-ink/70">
                {r.postSlug}{' '}
                <span className="text-xs text-ink/40">
                  · {new Date(r.pushedAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
