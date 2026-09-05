'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({
  endpoint,
  confirmMessage,
  label = 'Törlés',
}: {
  endpoint: string;
  confirmMessage: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(confirmMessage)) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Törlés sikertelen.');
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Hálózati hiba történt.');
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleDelete}
        disabled={loading}
        className="font-sans text-sm font-medium text-con transition-colors hover:text-con/70 disabled:opacity-60"
      >
        {loading ? 'Törlés…' : label}
      </button>
      {error && <span className="font-sans text-xs text-con">{error}</span>}
    </div>
  );
}
