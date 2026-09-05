'use client';

import { useState } from 'react';

export type CommentItem = {
  id: string;
  author: string;
  rating: number | null;
  text: string;
  createdAt: string;
};

function Stars({ value, onPick }: { value: number | null; onPick?: (v: number) => void }) {
  return (
    <span className="inline-flex gap-0.5" role={onPick ? 'radiogroup' : undefined} aria-label="Értékelés">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          aria-label={`${n} csillag`}
          className={`text-xl leading-none ${n <= (value ?? 0) ? 'text-signal' : 'text-ink/20'} ${onPick ? 'cursor-pointer hover:scale-110' : ''}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export default function CommentSection({
  postId,
  slug,
  initial,
  avg,
}: {
  postId: string;
  slug: string;
  initial: CommentItem[];
  avg: { count: number; avg: number | null };
}) {
  const [comments, setComments] = useState(initial);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [website, setWebsite] = useState(''); // honeypot: embernél mindig üres marad
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    setBusy(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, slug, author: author.trim(), text: text.trim(), rating, website }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || 'Hiba a küldéskor.');
        return;
      }
      if (j.comment) setComments((c) => [j.comment, ...c]);
      setAuthor('');
      setText('');
      setRating(null);
      setDone('Köszönjük! Hozzászólásod megjelent.');
    } catch {
      setError('Hálózati hiba - próbáld újra.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Hozzászólások" className="not-prose my-8">
      <h2 id="hozzaszolasok" className="scroll-mt-28 font-display text-xl font-bold text-ink">
        Hozzászólások{' '}
        <span className="font-sans text-sm font-normal text-ink/45">
          ({comments.length}
          {avg.avg != null && ` · olvasói átlag: ${avg.avg.toFixed(1)}/5`})
        </span>
      </h2>

      <form onSubmit={submit} className="mt-4 rounded-card border border-line bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-sans text-xs font-semibold text-ink/60">Név *</span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={40}
              placeholder="Pl. Gábor"
              className="mt-1 w-full rounded-tight border border-line bg-paper p-2.5 font-sans text-sm text-ink outline-none focus:border-teal-500"
            />
          </label>
          <div>
            <span className="font-sans text-xs font-semibold text-ink/60">Értékelésed (opcionális)</span>
            <div className="mt-1.5">
              <Stars value={rating} onPick={setRating} />
            </div>
          </div>
        </div>
        <label className="mt-4 block">
          <span className="font-sans text-xs font-semibold text-ink/60">Hozzászólás *</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Mi a tapasztalatod a termékkel? Írd meg!"
            className="mt-1 w-full rounded-tight border border-line bg-paper p-2.5 font-sans text-sm text-ink outline-none focus:border-teal-500"
          />
        </label>
        {/* Honeypot a botok ellen */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
          className="hidden"
          aria-hidden="true"
        />
        {error && <p className="mt-3 font-sans text-sm text-red-600">{error}</p>}
        {done && <p className="mt-3 font-sans text-sm text-teal-700">{done}</p>}
        <button type="submit" disabled={busy} className="btn-primary mt-4 disabled:opacity-40">
          {busy ? 'Küldés…' : 'Hozzászólás elküldése'}
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <p className="font-body text-sm text-ink/55">
            Még nincs hozzászólás. Legyél te az első, aki megosztja a tapasztalatát!
          </p>
        ) : (
          comments.map((c) => (
            <article key={c.id} className="rounded-card border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-sans text-sm font-semibold text-ink">{c.author}</span>
                {c.rating != null && <Stars value={c.rating} />}
                <span className="font-sans text-xs text-ink/40">
                  {new Date(c.createdAt).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap font-body text-sm leading-relaxed text-ink/80">{c.text}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
