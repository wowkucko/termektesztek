'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';

type Category = { name: string; slug: string };

type PanelProps = { categories: Category[]; onClose: () => void };

// Lusta trigger: a hamburger gomb az egyetlen, ami kezdetben hidratálódik.
// A menüpanelt (és a benne lévő élő keresőt) csak az első megnyitáskor
// töltjük le dinamikus importtal — a cikkek betöltését nem terheli a
// menü-kereső JS-e, csak akkor jön be, ha tényleg használják.
export default function MobileMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [Panel, setPanel] = useState<ComponentType<PanelProps> | null>(null);

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    if (!Panel) {
      try {
        const mod = await import('./MobileMenuPanel');
        setPanel(() => mod.default);
      } catch {
        // hálózati hiba: a menü nem nyílik meg — csendes visszatérés
        return;
      }
    }
    setOpen(true);
  }

  return (
    <div className="relative">
      {/* Hamburger gomb */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={open ? 'Menü bezárása' : 'Menü megnyitása'}
        className="relative z-50 flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 bg-white text-ink transition-colors hover:border-teal-500 hover:text-teal-600"
      >
        <span className="relative block h-4 w-5" aria-hidden="true">
          <span
            className={`absolute left-0 block h-0.5 w-5 rounded bg-current transition-all duration-300 ${
              open ? 'top-1.5 rotate-45' : 'top-0.5'
            }`}
          />
          <span
            className={`absolute left-0 top-1.5 block h-0.5 w-5 rounded bg-current transition-all duration-150 ${
              open ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-5 rounded bg-current transition-all duration-300 ${
              open ? 'top-1.5 -rotate-45' : 'top-[13px]'
            }`}
          />
        </span>
      </button>

      {Panel && open && <Panel categories={categories} onClose={() => setOpen(false)} />}
    </div>
  );
}
