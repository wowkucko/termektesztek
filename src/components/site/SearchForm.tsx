'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useCallback } from 'react';
import { cx } from '@/lib/utils';

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  rating: number | null;
  categoryName: string;
};

export default function SearchForm({ inlineResults = false }: { inlineResults?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // billentyűzet-navigáció
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced élő keresés
  const runSearch = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const j = await res.json();
        setResults(j.results || []);
        setOpen(true);
        setActive(-1);
      } catch {
        // hálózati hiba - csendben
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  // Klikk kívül: bezárás. Szándékosan CLICK-re (nem mousedown-ra) zárunk:
  // így a lenyíló becsukódása nem rántja ki a talajt a koppintás alól
  // (nincs layout-shift a tap és a navigáció között).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // Görgetésre is csukódjon: mobilon a nyitva maradt legördülő
    // különben letakarja az alatta lévő linkeket (dupla-tap kellene).
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = query.trim();
    if (!t) return;
    setOpen(false);
    router.push(`/kereses?q=${encodeURIComponent(t)}`);
  }

  // Billentyűzet-navigáció: nyilak + enter a találati listában
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter') {
      if (active >= 0 && results[active]) {
        e.preventDefault();
        setOpen(false);
        router.push(`/blog/${results[active].slug}`);
      }
      // active == -1 eseten a sima submit (teljes kereses) fut
    }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xs sm:w-64">
      <form onSubmit={handleSubmit} role="search">
        <label htmlFor="site-search" className="sr-only">
          Keresés a tesztek között
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            ref={inputRef}
            id="site-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              runSearch(e.target.value);
            }}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Keresés a tesztek között…"
            className="w-full rounded-full border border-ink/15 bg-white py-2 pl-9 pr-8 font-sans text-sm text-ink placeholder:text-ink/35 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
              <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-500" />
            </span>
          )}
        </div>
      </form>

      {/* Élő találati legördülő: desktopon overlay, mobil menüben folyamatba
          ágyazva (így nem takarja le az alatta lévő linkeket) */}
      {open && (
        <div
          className={
            inlineResults
              ? 'mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-card'
              : 'absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-card'
          }
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 font-sans text-sm text-ink/50">
              Nincs találat erre: „{query.trim()}”
            </p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/blog/${r.slug}`);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cx(
                      'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
                      active === i ? 'bg-teal-50' : 'bg-white'
                    )}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-teal-50 font-display text-sm font-bold text-teal-600"
                      aria-hidden="true"
                    >
                      {r.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.coverImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        r.categoryName.charAt(0)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-sans text-sm font-medium text-ink">{r.title}</span>
                      <span className="block truncate font-sans text-xs text-ink/45">
                        {r.categoryName}
                        {r.rating != null && <span className="font-semibold text-teal-700"> · {r.rating.toFixed(1)}/10</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {query.trim().length >= 2 && (
                <li className="border-t border-line">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/kereses?q=${encodeURIComponent(query.trim())}`);
                    }}
                    className="w-full px-4 py-2.5 text-left font-sans text-xs font-semibold text-teal-700 hover:bg-teal-50"
                  >
                    Összes találat megtekintése („{query.trim()}”) →
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
