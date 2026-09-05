'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DeleteButton from './DeleteButton';

type TagRow = { id: string; name: string; slug: string; _count: { posts: number } };

export default function TagManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || 'Hiba történt.');
        setCreating(false);
        return;
      }
      setName('');
      router.refresh();
    } catch {
      setCreateError('Hálózati hiba történt.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(tag: TagRow) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditError(null);
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/admin/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
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
        <h2 className="font-sans text-sm font-semibold text-ink">Új címke</h2>
        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <label className="field-label" htmlFor="tag-name">Név</label>
            <input id="tag-name" required value={name} onChange={(e) => setName(e.target.value)} className="field-input" />
          </div>
          <button type="submit" disabled={creating} className="btn-primary disabled:opacity-60">
            {creating ? 'Mentés…' : '+ Hozzáadás'}
          </button>
        </div>
        {createError && <p className="mt-2 font-sans text-sm text-con">{createError}</p>}
      </form>

      <div className="mt-6 flex flex-wrap gap-3">
        {tags.length === 0 && <p className="font-body text-sm text-ink/60">Még nincs címke.</p>}
        {tags.map((tag) =>
          editingId === tag.id ? (
            <div key={tag.id} className="flex items-center gap-2 rounded-card border border-teal-500 bg-white p-3">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="field-input w-40" />
              <button onClick={() => handleUpdate(tag.id)} disabled={saving} type="button" className="text-sm font-medium text-teal-600">
                {saving ? '…' : 'Mentés'}
              </button>
              <button onClick={() => setEditingId(null)} type="button" className="text-sm text-ink/50">
                Mégse
              </button>
              {editError && <span className="font-sans text-xs text-con">{editError}</span>}
            </div>
          ) : (
            <div key={tag.id} className="flex items-center gap-3 rounded-card border border-line bg-white px-4 py-2.5">
              <div>
                <p className="font-sans text-sm font-semibold text-ink">#{tag.name}</p>
                <p className="font-sans text-xs text-ink/40">{tag._count.posts} bejegyzés</p>
              </div>
              <button onClick={() => startEdit(tag)} className="font-sans text-xs font-medium text-teal-600 hover:text-teal-700">
                Szerk.
              </button>
              <DeleteButton
                endpoint={`/api/admin/tags/${tag.id}`}
                confirmMessage={`Biztosan törlöd a(z) "${tag.name}" címkét? A bejegyzésekről is levesszük.`}
                label="✕"
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
