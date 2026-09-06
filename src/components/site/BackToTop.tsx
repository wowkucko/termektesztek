'use client';

import { useEffect, useState } from 'react';

// Mobil-only floating "fel" gomb: 600px görgetés után jelenik meg,
// simán visszagörget az oldal tetejére. Asztalin rejtett (md:hidden).
// z-indexe a süti-banner (z-50) fölött van, hogy el nem fogadott
// consent mellett is koppintható maradjon.
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Ugrás az oldal tetejére"
      title="Fel az oldal tetejére"
      className="fixed bottom-6 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-card transition-transform hover:scale-110 active:scale-95 md:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
