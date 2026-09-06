'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cookie-consent';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function applyConsent(granted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, granted ? 'granted' : 'denied');
  } catch {
    // privát mód stb. - a választás csak erre a munkamenetre él
  }
  window.gtag?.('consent', 'update', {
    ad_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
    analytics_storage: granted ? 'granted' : 'denied',
  });
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (!stored) {
      setVisible(true);
    } else if (stored === 'granted') {
      // Korábbi elfogadás: a GA-script indulásakor még denied az alap,
      // ezért itt újra jelezzük a megadott hozzájárulást.
      window.gtag?.('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted',
      });
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Süti hozzájárulás"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-2xl rounded-card border border-line bg-white p-5 shadow-card">
        <p className="font-display text-base font-bold text-ink">Sütik használata 🍪</p>
        <p className="mt-1 font-body text-sm leading-relaxed text-ink/70">
          Oldalunk a működéshez szükséges sütin kívül — az ön hozzájárulásával — a Google
          Analytics mérőkódját használja a látogatottság névtelen mérésére. Az „Elfogadom"
          gombbal engedélyezi, az „Elutasítom" gombbal továbbra is süti-mentesen böngészhet.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => { applyConsent(true); setVisible(false); }} className="btn-primary">
            Elfogadom
          </button>
          <button
            type="button"
            onClick={() => { applyConsent(false); setVisible(false); }}
            className="btn-secondary"
          >
            Elutasítom
          </button>
        </div>
      </div>
    </div>
  );
}
