'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SyncItem = {
  id: string;
  name: string;
  status: string;
  lastError: string | null;
  attempts: number;
  allegroUrl: string | null;
  postSlug: string | null;
  createdAt: string;
};

type SyncState = {
  running: boolean;
  paused: boolean;
  rateLimited: boolean;
  rateLimitUntil: string | null;
  lastRunAt: string | null;
  log: string;
  processedCount: number;
};

type SyncData = {
  state: SyncState;
  items: SyncItem[];
  counts: { queued: number; done: number; failed: number };
};

type GeminiKeyStatus = {
  keyLabel: string;
  inCooldown: boolean;
  cooldownUntil: string | null;
  retryInMs: number | null;
};

type ControlState = {
  workerRunning: boolean;
  dbRunning: boolean;
  workersDisabled?: boolean;
  rateLimit: { limited: boolean; reason?: string; rpmUsed: number; rpdUsed: number; maxRpm: number; maxRpd: number };
  geminiKeys: GeminiKeyStatus[];
};

const STATUS_LABEL: Record<string, string> = {
  QUEUED: 'Várakozik',
  SCRAPING: 'Allegro adatgyűjtés',
  GENERATING: 'Gemini cikkírás',
  DONE: 'Kész',
  FAILED: 'Hibás',
  SKIPPED: 'Kihagyva',
};

const STATUS_COLOR: Record<string, string> = {
  QUEUED: 'bg-ink/10 text-ink/60',
  SCRAPING: 'bg-blue-100 text-blue-700',
  GENERATING: 'bg-violet-100 text-violet-700',
  DONE: 'bg-pro/10 text-pro',
  FAILED: 'bg-red-100 text-red-700',
  SKIPPED: 'bg-ink/10 text-ink/40',
};

export default function SyncPanel() {
  const [data, setData] = useState<SyncData | null>(null);
  const [control, setControl] = useState<ControlState | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMsg = useCallback((msg: string) => {
    setMessage(msg);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 6000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([
        fetch('/api/admin/sync').then((r) => r.json()),
        fetch('/api/admin/sync/control').then((r) => r.json()),
      ]);
      setData(d);
      setControl(c);
    } catch {
      // hagyjuk, a következő poll próbálkozik
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const addProducts = async () => {
    const names = input
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      });
      const j = await res.json();
      if (res.ok) {
        showMsg(`${j.added} termék felvéve a szinkronlistába.`);
        setInput('');
        refresh();
      } else {
        showMsg(j.error || 'Hiba a termékek felvételekor.');
      }
    } finally {
      setBusy(false);
    }
  };

  const controlAction = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/sync/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(extra || {}) }),
      });
      const j = await res.json();
      showMsg(j.message || j.error || 'OK.');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt a tételt a szinkronlistából?')) return;
    await fetch(`/api/admin/sync/items?id=${id}`, { method: 'DELETE' });
    refresh();
  };

  const clearFailed = async () => {
    await fetch('/api/admin/sync/items?all=failed', { method: 'DELETE' });
    showMsg('Hibás tételek törölve.');
    refresh();
  };

  const retryFailed = async () => {
    if (!confirm('Biztosan újrapróbálod az összes hibás tételt? A próbálkozások száma nullázódik.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/sync/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry-failed' }),
      });
      const j = await res.json();
      showMsg(res.ok ? `${j.requeued ?? 0} hibás tétel visszasorolva a várakozó listára.` : j.error || 'Hiba az újrapróbáláskor.');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const clearDone = async () => {
    await fetch('/api/admin/sync/items?all=done', { method: 'DELETE' });
    showMsg('Kész tételek törölve a listából (a blogbejegyzések megmaradnak).');
    refresh();
  };

  const state = data?.state;
  const running = control?.workerRunning || state?.running;
  const rateLimited = state?.rateLimited;
  const rateLimitUntil = state?.rateLimitUntil ? new Date(state.rateLimitUntil).toLocaleTimeString('hu-HU') : null;

  return (
    <div className="space-y-6">
      {/* Státusz sáv */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-chip px-3 py-1.5 font-sans text-sm font-semibold ${
            rateLimited ? 'bg-amber-500/10 text-amber-700' : running ? 'bg-pro/10 text-pro' : 'bg-ink/10 text-ink/60'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${rateLimited ? 'bg-amber-500' : running ? 'animate-pulse bg-pro' : 'bg-ink/40'}`} />
          {rateLimited
            ? `Rate limit! Újrapróbálkozás: ${rateLimitUntil}`
            : running
              ? state?.paused
                ? 'Szüneteltetve (futás közben)'
                : 'Szinkron fut'
              : 'Áll'}
        </span>
        {control && (
          <span className="font-sans text-xs text-ink/50">
            Gemini: {control.rateLimit.rpmUsed}/{control.rateLimit.maxRpm} perc · {control.rateLimit.rpdUsed}/{control.rateLimit.maxRpd} nap
          </span>
        )}
        {state && state.processedCount > 0 && (
          <span className="font-sans text-xs text-ink/50">Összes kész cikk: {state.processedCount}</span>
        )}
      </div>

      {/* Gemini kulcsok állapota */}
      {control?.geminiKeys && control.geminiKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-card border border-line bg-white px-4 py-2.5">
          <span className="font-sans text-xs font-medium text-ink/50">Gemini kulcsok:</span>
          {control.geminiKeys.map((k) => (
            <span
              key={k.keyLabel}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-ink/75"
              title={k.inCooldown ? `Cooldown-ban, visszatér: ${k.cooldownUntil ? new Date(k.cooldownUntil).toLocaleString('hu-HU') : '?'}` : 'Aktív, használható'}
            >
              <span className={`h-2 w-2 rounded-full ${k.inCooldown ? 'bg-amber-500' : 'bg-pro'}`} />
              {k.keyLabel}
              {k.inCooldown && k.cooldownUntil && (
                <span className="font-sans text-amber-700">· visszatér {new Date(k.cooldownUntil).toLocaleTimeString('hu-HU')}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Vezérlő gombok */}
      {control?.workersDisabled && (
        <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 font-sans text-sm text-amber-800">
          🚫 Éles mód: a workerek ezen a szerveren le vannak tiltva (WORKERS_DISABLED=true). A
          szinkront az itthoni gépen futtasd, az eredményt push-scripttel töltsd fel.
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => controlAction('start', rateLimited && !running ? { force: true } : undefined)}
          disabled={busy || !!running || control?.workersDisabled}
          className="btn-primary disabled:opacity-40"
          title={rateLimited && !running ? 'A rate limit miatti várakozást átugorja és azonnal újraindítja' : undefined}
        >
          {rateLimited && !running ? '▶ Kényszerített indítás (szünet átugrása)' : '▶ Szinkron indítása'}
        </button>
        <button onClick={() => controlAction('pause')} disabled={busy || !running || state?.paused} className="btn-secondary disabled:opacity-40">
          ⏸ Szüneteltetés
        </button>
        <button onClick={() => controlAction('resume')} disabled={busy || !running || !state?.paused || control?.workersDisabled} className="btn-secondary disabled:opacity-40">
          ▶ Folytatás
        </button>
        <button onClick={() => controlAction('stop')} disabled={busy || !running} className="btn-secondary disabled:opacity-40">
          ■ Leállítás
        </button>
      </div>

      {message && (
        <div className="rounded-card border border-teal-200 bg-teal-50 px-4 py-3 font-sans text-sm text-teal-800">{message}</div>
      )}

      {/* Új termékek felvétele */}
      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold text-ink">Új termékek felvétele</h2>
        <p className="mt-1 font-body text-sm text-ink/50">
          Írd be a termékek neveit, soronként egyet. Pl. „iPhone 15”, „Xiaomi Roborock S8”, „Sony WH-1000XM5”.
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          placeholder={'iPhone 15\nSony WH-1000XM5\nPhilips Airfryer XXL'}
          className="mt-3 w-full rounded-tight border border-line bg-paper p-3 font-sans text-sm text-ink outline-none focus:border-teal-500"
        />
        <button onClick={addProducts} disabled={busy || !input.trim()} className="btn-primary mt-3 disabled:opacity-40">
          + Felvétel a szinkronlistába
        </button>
      </div>

      {/* Szinkronlista */}
      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Szinkronlista {data && <span className="font-sans text-sm font-normal text-ink/40">({data.items.length})</span>}
          </h2>
          <div className="flex gap-3">
            <button onClick={retryFailed} disabled={busy || !data?.counts.failed} className="font-sans text-xs font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40">
              ↻ Hibás tételek újrapróbálása
            </button>
            <button onClick={clearFailed} className="font-sans text-xs font-medium text-red-600 hover:text-red-700">
              Hibások törlése
            </button>
            <button onClick={clearDone} className="font-sans text-xs font-medium text-ink/50 hover:text-ink/70">
              Készek törlése
            </button>
          </div>
        </div>
        {!data || data.items.length === 0 ? (
          <p className="p-6 font-body text-sm text-ink/60">Nincs egyetlen tétel sem. Vegyél fel termékeket fentebb.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-3 font-medium">Termék</th>
                <th className="px-5 py-3 font-medium">Állapot</th>
                <th className="px-5 py-3 font-medium">Próba</th>
                <th className="px-5 py-3 font-medium">Eredmény</th>
                <th className="px-5 py-3 font-medium text-right">Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((item) => (
                <tr key={item.id} className="font-sans text-sm">
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink">{item.name}</span>
                    {item.allegroUrl && (
                      <a href={item.allegroUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-teal-600 hover:underline">
                        allegro.hu ↗
                      </a>
                    )}
                    {item.lastError && (
                      <p className="mt-0.5 max-w-md truncate text-xs text-red-500" title={item.lastError}>
                        {item.lastError}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-chip px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[item.status] || 'bg-ink/10'}`}>
                      {STATUS_LABEL[item.status] || item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink/50">{item.attempts}</td>
                  <td className="px-5 py-3">
                    {item.postSlug ? (
                      <a href={`/blog/${item.postSlug}`} target="_blank" className="font-medium text-teal-600 hover:text-teal-700">
                        Cikk ↗
                      </a>
                    ) : (
                      <span className="text-ink/30">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => deleteItem(item.id)} className="font-medium text-red-600 hover:text-red-700">
                      Törlés
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Log */}
      <div className="rounded-card border border-line bg-ink p-5">
        <h2 className="font-display text-lg font-bold text-white">Szinkron napló</h2>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/70">
          {state?.log || 'Még nincs naplóbejegyzés.'}
        </pre>
      </div>
    </div>
  );
}
