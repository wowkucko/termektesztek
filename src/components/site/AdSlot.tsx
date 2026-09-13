'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_ID } from '@/lib/ads';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Egy kézi hirdetési egység. Csak akkor renderel, ha van publisher ID ÉS slot ID -
export default function AdSlot({ slot, format = 'auto', label }: { slot: string; format?: string; label: string }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // hirdetésblokkoló / még be nem töltött script - csendben
    }
  }, []);

  if (!ADSENSE_ID || !slot) return null;

  return (
    <div aria-label={label} className="not-prose my-8 overflow-hidden rounded-card border border-line bg-white/60">
      <p className="px-4 pt-2 font-sans text-[10px] uppercase tracking-wide text-ink/35">Hirdetés</p>
      <ins
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
