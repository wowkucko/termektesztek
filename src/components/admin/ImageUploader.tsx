'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';

export default function ImageUploader({
  label,
  value,
  onChange,
  altValue,
  onAltChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  altValue?: string;
  onAltChange?: (alt: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'A feltöltés sikertelen.');
        setUploading(false);
        return;
      }

      onChange(json.url);
    } catch {
      setError('Hálózati hiba történt a feltöltés közben.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <label className="field-label">{label}</label>

      {value ? (
        <div className="relative mb-3 aspect-video w-full max-w-sm overflow-hidden rounded-tight border border-ink/15">
          <Image src={value} alt="Előnézet" fill className="object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-chip bg-ink/70 px-2.5 py-1 font-sans text-xs font-semibold text-white hover:bg-con"
          >
            Eltávolítás
          </button>
        </div>
      ) : (
        <p className="mb-3 font-sans text-xs text-ink/45">Nincs kép kiválasztva.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        disabled={uploading}
        className="block w-full max-w-sm font-sans text-sm text-ink/70 file:mr-4 file:rounded-tight file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:font-sans file:text-sm file:font-semibold file:text-teal-700 hover:file:bg-teal-100"
      />
      {uploading && <p className="mt-2 font-sans text-xs text-ink/50">Feltöltés…</p>}
      {error && <p className="mt-2 font-sans text-xs text-con">{error}</p>}

      {onAltChange && (
        <div className="mt-3 max-w-sm">
          <label className="field-label">Kép alt szövege (SEO és akadálymentesség)</label>
          <input
            type="text"
            value={altValue || ''}
            onChange={(e) => onAltChange(e.target.value)}
            placeholder="pl. Minta Termék X1 fekete színben, asztalon"
            className="field-input"
          />
        </div>
      )}
    </div>
  );
}
