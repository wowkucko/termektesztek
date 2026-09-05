'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type SearchLogRow = {
  query: string;
  count: number;
  avgResults: number;
  lastSearched: string;
};

export default function SearchLogPanel({ rows }: { rows: SearchLogRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const addToSync = async (query: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: [query] }),
      });
      const j = await res.json();
      setMessage(res.ok ? `„${query}" felvéve a szinkronlistába.` : j.error || 'Hiba a felvételkor.');
    } finally {
      setBusy(false);
    }
  };

  const clearLog = async () => {
    if (!confirm('Biztosan törlöd a teljes keresési naplót?')) return;
    await fetch('/api/admin/search-log', { method: 'DELETE' });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-card border border-teal-200 bg-teal-50 px-4 py-3 font-sans text-sm text-teal-800">
          {message}
        </div>
      )}

      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold text-ink">Mire keresnek az olvasók?</h2>
        <p className="mt-1 font-body text-sm text-ink/50">
          Belső keresések gyakoriság szerint. A <strong>0 találatos</strong> keresések a
          legjobb új cikk-ötletek: egy kattintással felveheted őket a szinkronlistába.
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Keresések <span className="font-sans text-sm font-normal text-ink/40">({rows.length})</span>
          </h2>
          {rows.length > 0 && (
            <button onClick={clearLog} className="font-sans text-xs font-medium text-ink/50 hover:text-ink/70">
              Napló törlése
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="p-6 font-body text-sm text-ink/60">Még nincs naplózott keresés.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-3 font-medium">Keresés</th>
                <th className="px-5 py-3 font-medium">Alkalom</th>
                <th className="px-5 py-3 font-medium">Átlag találat</th>
                <th className="px-5 py-3 font-medium">Utoljára</th>
                <th className="px-5 py-3 font-medium text-right">Művelet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.query} className="font-sans text-sm">
                  <td className="px-5 py-3 font-medium text-ink">„{r.query}”</td>
                  <td className="px-5 py-3 text-ink/60">{r.count}</td>
                  <td className="px-5 py-3">
                    {r.avgResults === 0 ? (
                      <span className="rounded-chip bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                        0 találat
                      </span>
                    ) : (
                      <span className="text-ink/60">{r.avgResults}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink/50">
                    {new Date(r.lastSearched).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => addToSync(r.query)}
                      disabled={busy}
                      className="font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40"
                    >
                      + Szinkronba
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
