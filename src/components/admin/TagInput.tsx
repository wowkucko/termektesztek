'use client';

import { useState } from 'react';

export default function TagInput({
  value,
  onChange,
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const name = draft.trim();
    if (!name) return;
    if (!value.some((t) => t.toLowerCase() === name.toLowerCase())) {
      onChange([...value, name]);
    }
    setDraft('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeTag(name: string) {
    onChange(value.filter((t) => t !== name));
  }

  return (
    <div>
      <label className="field-label" htmlFor="tags-input">Címkék</label>
      <div className="flex flex-wrap items-center gap-2 rounded-tight border border-ink/15 bg-white p-2.5 focus-within:border-teal-500">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1.5 rounded-chip bg-teal-50 px-2.5 py-1 font-sans text-xs font-medium text-teal-700"
          >
            {tag}
            <button type="button" onClick={() => removeTag(tag)} aria-label={`${tag} eltávolítása`} className="hover:text-con">
              ✕
            </button>
          </span>
        ))}
        <input
          id="tags-input"
          list="tag-suggestions"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={value.length === 0 ? 'Írj be egy címkét, majd Enter…' : ''}
          className="min-w-[10ch] flex-1 border-0 p-1 font-sans text-sm outline-none"
        />
      </div>
      <datalist id="tag-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="mt-1.5 font-sans text-xs text-ink/40">
        Új címke begépelve automatikusan létrejön mentéskor.
      </p>
    </div>
  );
}
