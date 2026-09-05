'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DeleteButton from './DeleteButton';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count: { posts: number };
};

export default function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || 'Hiba történt.');
        setCreating(false);
        return;
      }
      setName('');
      setDescription('');
      router.refresh();
    } catch {
      setCreateError('Hálózati hiba történt.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(cat: CategoryRow) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description || '');
    setEditError(null);
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDescription || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEditError(json.error || 'Hiba történt.');
        setSaving(false);
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setEditError('Hálózati hiba történt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="rounded-card border border-line bg-white p-5">
        <h2 className="font-sans text-sm font-semibold text-ink">Új kategória</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,2fr,auto] sm:items-end">
          <div>
            <label className="field-label" htmlFor="cat-name">Név</label>
            <input id="cat-name" required value={name} onChange={(e) => setName(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="cat-desc">Leírás (opcionális)</label>
            <input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="field-input" />
          </div>
          <button type="submit" disabled={creating} className="btn-primary h-fit disabled:opacity-60">
            {creating ? 'Mentés…' : '+ Hozzáadás'}
          </button>
        </div>
        {createError && <p className="mt-2 font-sans text-sm text-con">{createError}</p>}
      </form>

      <div className="mt-6 divide-y divide-line rounded-card border border-line bg-white">
        {categories.length === 0 && <p className="p-5 font-body text-sm text-ink/60">Még nincs kategória.</p>}
        {categories.map((cat) => (
          <div key={cat.id} className="p-5">
            {editingId === cat.id ? (
              <div className="space-y-3">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="field-input" />
                <input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="field-input"
                  placeholder="Leírás"
                />
                {editError && <p className="font-sans text-sm text-con">{editError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpdate(cat.id)}
                    disabled={saving}
                    type="button"
                    className="btn-primary disabled:opacity-60"
                  >
                    {saving ? 'Mentés…' : 'Mentés'}
                  </button>
                  <button onClick={() => setEditingId(null)} type="button" className="btn-secondary">
                    Mégse
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-sans text-sm font-semibold text-ink">{cat.name}</p>
                  {cat.description && <p className="mt-0.5 font-sans text-xs text-ink/50">{cat.description}</p>}
                  <p className="mt-1 font-sans text-xs text-ink/40">
                    /kategoria/{cat.slug} · {cat._count.posts} bejegyzés
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <button onClick={() => startEdit(cat)} className="font-sans text-sm font-medium text-teal-600 hover:text-teal-700">
                    Szerkesztés
                  </button>
                  <DeleteButton
                    endpoint={`/api/admin/categories/${cat.id}`}
                    confirmMessage={`Biztosan törlöd a(z) "${cat.name}" kategóriát?`}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
