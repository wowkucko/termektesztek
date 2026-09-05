'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Sikertelen bejelentkezés.');
        setLoading(false);
        return;
      }

      router.push(nextPath || '/admin');
      router.refresh();
    } catch {
      setError('Hálózati hiba történt. Próbáld újra.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-card border border-white/10 bg-white p-8 shadow-card">
      <h1 className="font-display text-xl font-bold text-ink">Bejelentkezés</h1>
      <p className="mt-1 font-body text-sm text-ink/60">Lépj be az admin felület eléréséhez.</p>

      {error && (
        <p className="mt-4 rounded-tight bg-con/10 px-3 py-2 font-sans text-sm text-con">{error}</p>
      )}

      <div className="mt-6">
        <label htmlFor="email" className="field-label">E-mail cím</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="password" className="field-label">Jelszó</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary mt-6 w-full disabled:opacity-60">
        {loading ? 'Bejelentkezés…' : 'Bejelentkezés'}
      </button>
    </form>
  );
}
