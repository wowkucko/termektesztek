'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type LinkItem = {
  id: string;
  postId: string;
  postTitle: string;
  oldUrl: string;
  status: string;
  alive: boolean | null;
  newUrl: string | null;
  reason: string | null;
  lastError: string | null;
  attempts: number;
  createdAt: string;
};

type LinkState = {
  running: boolean;
  paused: boolean;
  rateLimited: boolean;
  rateLimitUntil: string | null;
  log: string;
  processedCount: number;
  replacedCount: number;
};

type LinkData = {
  state: LinkState;
  items: LinkItem[];
  counts: { active: number; ok: number; replaced: number; notFound: number; failed: number };
  schedule: { intervalHours: number; enabled: boolean; nextRunAt: string | null };
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
  CHECKING: 'Link ellenőrzés',
  SEARCHING: 'Keresés',
  MATCHING: 'Gemini párosítás',
  OK: 'Él',
  REPLACED: 'Lecserélve',
  NOT_FOUND: 'Nincs találat',
  FAILED: 'Hiba',
};

const STATUS_COLOR: Record<string, string> = {
  QUEUED: 'bg-ink/10 text-ink/60',
  CHECKING: 'bg-blue-100 text-blue-700',
  SEARCHING: 'bg-violet-100 text-violet-700',
  MATCHING: 'bg-amber-100 text-amber-700',
  OK: 'bg-pro/10 text-pro',
  REPLACED: 'bg-teal-100 text-teal-700',
  NOT_FOUND: 'bg-orange-100 text-orange-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default function LinkCheckPanel() {
  const [data, setData] = useState<LinkData | null>(null);
  const [control, setControl] = useState<ControlState | null>(null);
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
        fetch('/api/admin/linkcheck').then((r) => r.json()),
        fetch('/api/admin/linkcheck/control').then((r) => r.json()),
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

  const controlAction = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/linkcheck/control', {
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
    if (!confirm('Biztosan törlöd ezt a tételt a listából?')) return;
    await fetch(`/api/admin/linkcheck/items?id=${id}`, { method: 'DELETE' });
    refresh();
  };

  const retryFailed = async () => {
    if (!confirm('Biztosan újrapróbálod az összes hibás tételt? A próbálkozások száma nullázódik.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/linkcheck/items', {
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

  const clearGroup = async (group: 'failed' | 'notfound' | 'done') => {
    const label = group === 'failed' ? 'Hibás' : group === 'notfound' ? 'Találat nélküli' : 'Lecserélt';
    if (!confirm(`Biztosan törlöd az összes ${label.toLowerCase()} tételt?`)) return;
    const res = await fetch(`/api/admin/linkcheck/items?all=${group}`, { method: 'DELETE' });
    const j = await res.json();
    showMsg(`${j.deleted ?? 0} tétel törölve.`);
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
                : 'Ellenőrzés fut'
              : 'Áll'}
        </span>
        {control?.rateLimit && (
          <span className="font-sans text-xs text-ink/50">
            Gemini: {control.rateLimit.rpmUsed}/{control.rateLimit.maxRpm} perc · {control.rateLimit.rpdUsed}/{control.rateLimit.maxRpd} nap
          </span>
        )}
        {state && (state.processedCount > 0 || state.replacedCount > 0) && (
          <span className="font-sans text-xs text-ink/50">
            Ellenőrizve: {state.processedCount} · Lecserélve: {state.replacedCount}
          </span>
        )}
        {data && data.items.length > 0 && (
          <span className="font-sans text-xs text-ink/50">
            Lista: {data.items.length} ({data.counts.active} aktív · {data.counts.ok} él · {data.counts.replaced} cserélt · {data.counts.notFound}{' '}
            nincs találat · {data.counts.failed} hiba)
          </span>
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
          link-ellenőrzést az itthoni gépen futtasd.
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => controlAction('start', rateLimited && !running ? { force: true } : undefined)}
          disabled={busy || !!running || control?.workersDisabled}
          className="btn-primary disabled:opacity-40"
          title={rateLimited && !running ? 'A rate limit miatti várakozást átugorja és azonnal újraindítja' : undefined}
        >
          {rateLimited && !running ? '▶ Kényszerített indítás (szünet átugrása)' : '▶ Ellenőrzés indítása'}
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
        <button
          onClick={() => controlAction('rebuild')}
          disabled={busy || !!running}
          className="btn-secondary disabled:opacity-40"
          title="A sort újraépíti a jelenlegi PUBLISHED posztok affiliate linkjeiből"
        >
          ♻ Lista újraépítése
        </button>
      </div>

      {message && (
        <div className="rounded-card border border-teal-200 bg-teal-50 px-4 py-3 font-sans text-sm text-teal-800">{message}</div>
      )}

      {/* Ütemezés */}
      {data?.schedule && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line bg-white px-4 py-3">
          <span className="font-sans text-sm text-ink/75">
            Ütemezett futás:{' '}
            <strong className={data.schedule.enabled ? 'text-pro' : 'text-ink/50'}>
              {data.schedule.enabled ? 'bekapcsolva' : 'kikapcsolva'}
            </strong>
            {data.schedule.enabled && (
              <>
                <span className="mx-2 text-ink/25" aria-hidden="true">·</span>
                {data.schedule.intervalHours >= 24
                  ? `${Math.round(data.schedule.intervalHours / 24)} naponta`
                  : `${data.schedule.intervalHours} óránként`}
                {data.schedule.nextRunAt && (
                  <>
                    <span className="mx-2 text-ink/25" aria-hidden="true">·</span>
                    következő: {new Date(data.schedule.nextRunAt).toLocaleString('hu-HU')}
                  </>
                )}
              </>
            )}
          </span>
          <button
            onClick={() => controlAction('schedule', { enabled: !data.schedule.enabled })}
            disabled={busy || control?.workersDisabled}
            className="btn-secondary px-4 py-1.5 text-xs disabled:opacity-40"
            title={data.schedule.enabled ? 'Kikapcsolja az automatikus futtatást' : 'Bekapcsolja az automatikus (heti) futtatást'}
          >
            {data.schedule.enabled ? 'Kikapcsolás' : 'Bekapcsolás'}
          </button>
        </div>
      )}

      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold text-ink">Mi történik?</h2>
        <p className="mt-1 font-body text-sm leading-relaxed text-ink/60">
          A folyamat végigjárja a publikált bejegyzések Allegro affiliate linkjeit. Ha egy link már nem él, megkeresi az Allegro-n a terméket
          (márka + modell név, hasonló ár alapján), a Gemini-vel ellenőrizteti, hogy valóban ugyanaz a termék-e (nem kiegészítő vagy másik
          modell), és ha egyértelmű az egyezés, automatikusan lecseréli a linket az új, valószínűleg más eladónál lévő ajánlatra. A Gemini
          hívások batchben futnak, hogy a rate limitet kíméljék.
        </p>
      </div>

      {/* Ellenőrző lista */}
      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Ellenőrző lista {data && <span className="font-sans text-sm font-normal text-ink/40">({data.items.length})</span>}
          </h2>
          <div className="flex gap-3">
            <button onClick={retryFailed} disabled={busy || !data?.counts.failed} className="font-sans text-xs font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40">
              ↻ Hibás tételek újrapróbálása
            </button>
            <button onClick={() => clearGroup('failed')} className="font-sans text-xs font-medium text-red-600 hover:text-red-700">
              Hibások törlése
            </button>
            <button onClick={() => clearGroup('notfound')} className="font-sans text-xs font-medium text-orange-600 hover:text-orange-700">
              Találat nélküliek törlése
            </button>
            <button onClick={() => clearGroup('done')} className="font-sans text-xs font-medium text-ink/50 hover:text-ink/70">
              Lecseréltek törlése
            </button>
          </div>
        </div>
        {!data || data.items.length === 0 ? (
          <p className="p-6 font-body text-sm text-ink/60">
            Üres a lista. Kattints a „Lista újraépítése" gombra, hogy a jelenlegi posztok bekerüljenek.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-5 py-3 font-medium">Bejegyzés</th>
                  <th className="px-5 py-3 font-medium">Régi link</th>
                  <th className="px-5 py-3 font-medium">Állapot</th>
                  <th className="px-5 py-3 font-medium">Új link / indok</th>
                  <th className="px-5 py-3 font-medium">Próba</th>
                  <th className="px-5 py-3 font-medium text-right">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((item) => (
                  <tr key={item.id} className="font-sans text-sm">
                    <td className="px-5 py-3">
                      <a
                        href={`/admin/posts/${item.postId}/edit`}
                        className="font-medium text-ink hover:text-teal-600"
                        title={item.postTitle}
                      >
                        {item.postTitle.length > 40 ? `${item.postTitle.slice(0, 40)}…` : item.postTitle}
                      </a>
                      {item.lastError && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-red-500" title={item.lastError}>
                          {item.lastError}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={item.oldUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-teal-600 hover:underline"
                        title={item.oldUrl}
                      >
                        {item.oldUrl.replace(/^https?:\/\//, '').slice(0, 40)}
                      </a>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-chip px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[item.status] || 'bg-ink/10'}`}>
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                    </td>
                    <td className="max-w-xs px-5 py-3">
                      {item.newUrl ? (
                        <a href={item.newUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:underline" title={item.newUrl}>
                          Új link ↗
                        </a>
                      ) : (
                        <span className="text-xs text-ink/50">{item.reason || '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink/50">{item.attempts}</td>
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
        <h2 className="font-display text-lg font-bold text-white">Ellenőrzési napló</h2>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/70">
          {state?.log || 'Még nincs naplóbejegyzés.'}
        </pre>
      </div>
    </div>
  );
}