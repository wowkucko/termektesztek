'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_ID } from '@/lib/ads';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Az AdSense push() a DOM ÖSSZES betöltetlen ins elemét megpróbálja egyszerre
// kitölteni, ezért több hirdetési egységnél (pl. a cikkoldalon 3 van) a második
// és további push-ek "TagError: ... already have ads in them" hibát dobnak —
// aszinkron módon, így a try/catch sem fogja el (Playwright auditban bukott fel).
// Megoldás: a komponensek csak fill-kérelmet jelentenek, és egy rövid,
// közös időablakban EGYETLEN push megy a könyvtárnak, ami az összes addig
// mountolt, betöltetlen egységet egyszerre tölti.
let fillRequested = false;
function requestAdFill() {
  if (fillRequested) return;
  fillRequested = true;
  window.setTimeout(() => {
    fillRequested = false;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // hirdetésblokkoló / még be nem töltött script - csendben
    }
  }, 150);
}

// Egy kézi hirdetési egység. Csak akkor renderel, ha van publisher ID ÉS slot ID -
export default function AdSlot({ slot, format = 'auto', label }: { slot: string; format?: string; label: string }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    requestAdFill();
  }, []);

  if (!ADSENSE_ID || !slot) return null;

  return (
    <div aria-label={label} className="not-prose my-8 overflow-hidden rounded-card border border-line bg-white/60">
      <p className="px-4 pt-2 font-sans text-[10px] uppercase tracking-wide text-ink/65">Hirdetés</p>
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
