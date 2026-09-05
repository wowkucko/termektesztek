'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={
        compact
          ? 'shrink-0 rounded-tight border border-white/15 px-3 py-1.5 font-sans text-xs text-white/70 transition-colors hover:border-signal hover:text-white disabled:opacity-60'
          : 'w-full rounded-tight border border-white/15 px-3 py-2 text-left font-sans text-sm text-white/70 transition-colors hover:border-signal hover:text-white disabled:opacity-60'
      }
    >
      {loading ? 'Kijelentkezés…' : 'Kijelentkezés'}
    </button>
  );
}
