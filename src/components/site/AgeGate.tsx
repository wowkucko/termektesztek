'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adultConsentCookieString } from '@/lib/adultContent';

/**
 * 18+ korhatár-kapu (age gate) a szexuális jellegű terméktesztek elé.
 *
 * A cikk tartalma a szerveren NEM renderelődik, amíg nincs érvényes
 * elfogadás-süti: ez a panel csak a figyelmeztetést adja, az elfogadás után
 * a süti beállításával és a szerver-komponens újratöltésével ("router.refresh")
 * jelenik meg a cikk. Így a kapu nem megkerülhető kliens-oldali trükkel, és a
 * tiltott tartalom nem kerül a HTML-be a hozzájárulás előtt.
 *
 * A panel a meglévő arculatot használja (rounded-card, shadow-card, a signal
 * színnel jelölt figyelmeztetés, a VerdictStamp-hez illő szaggatott "18+" kör).
 */
export default function AgeGate() {
  const router = useRouter();
  const [certified, setCertified] = useState(false);
  const [state, setState] = useState<'ask' | 'entering' | 'declined'>('ask');
  const panelRef = useRef<HTMLDivElement>(null);

  // A panel kapja a fókuszt, hogy a képernyőolvasó és a billentyűzetes
  // navigáció azonnal a döntésnél legyen (a cikk tartalma még nem elérhető).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  function accept() {
    if (!certified) return;
    try {
      document.cookie = adultConsentCookieString(window.location.protocol === 'https:');
    } catch {
      // Ha a sütik tiltottak, a kapu nem kerülhető meg: marad a figyelmeztetés.
    }
    setState('entering');
    router.refresh();
  }

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-labelledby="age-gate-title"
          aria-describedby="age-gate-desc"
          className="rounded-card border border-line bg-white p-6 shadow-card outline-none sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="inline-flex h-16 w-16 shrink-0 -rotate-6 flex-col items-center justify-center rounded-full border-2 border-dashed border-signal-600 bg-white font-display text-2xl font-bold text-signal-600"
            >
              18+
            </span>
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-signal-700">
                Korhatár-kapu · felnőtt tartalom
              </p>
              <h1
                id="age-gate-title"
                className="mt-1.5 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl"
              >
                Ez a cikk csak 18 éven felülieknek szól
              </h1>
            </div>
          </div>

          <p id="age-gate-desc" className="mt-5 font-body text-base leading-relaxed text-ink/75">
            A bejegyzés szexuális jellegű termék tesztjét mutatja be, ezért a benne lévő leírás és
            képek felnőtt tartalomnak minősülnek. A kiskorúak védelme érdekében a cikk teljes
            szövegét csak akkor jelenítjük meg, ha megerősíted, hogy elmúltál 18 éves.
          </p>

          {state === 'declined' ? (
            <div aria-live="polite" className="mt-6 rounded-tight border border-line bg-teal-50/50 p-5">
              <p className="font-display text-lg font-semibold text-ink">
                Rendben, ezt a cikket nem nyitjuk meg.
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-ink/75">
                A jogszabályok miatt 18 éven aluliaknak nem jeleníthetjük meg a szexuális jellegű
                tartalmakat. Nézz körül nyugodtan a többi terméktesztünk között — azokat mindenki
                számára elérhetővé tettük.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/" className="btn-primary">
                  Vissza a kezdőlapra
                </Link>
                <button type="button" onClick={() => setState('ask')} className="btn-secondary">
                  Mégis elmúltam 18 éves
                </button>
              </div>
            </div>
          ) : (
            <>
              <ul className="mt-5 space-y-2 font-sans text-sm text-ink/75">
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="font-bold text-signal-600">
                    ›
                  </span>
                  <span>
                    A cikk felnőtt (18+) termékről szól: a részletes leírás kizárólag felnőtteknek
                    szól.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="font-bold text-signal-600">
                    ›
                  </span>
                  <span>
                    A belépés önkéntes és visszavonható: a süti törlésével a kapu újra megjelenik.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="font-bold text-signal-600">
                    ›
                  </span>
                  <span>Nem kérünk és nem tárolunk személyes adatot, életkort vagy okmányadatot.</span>
                </li>
              </ul>

              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-tight border border-line bg-teal-50/50 p-4">
                <input
                  type="checkbox"
                  checked={certified}
                  onChange={(e) => setCertified(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-teal-500"
                />
                <span className="font-sans text-sm font-medium leading-relaxed text-ink">
                  Kijelentem, hogy elmúltam 18 éves, és kérem, hogy a cikk felnőtt tartalmát
                  megjelenítsétek.
                </span>
              </label>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={accept}
                  disabled={!certified || state === 'entering'}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {state === 'entering' ? 'Belépés…' : 'Elfogadom és belépek'}
                </button>
                <button type="button" onClick={() => setState('declined')} className="btn-secondary">
                  Nem vagyok 18 éves
                </button>
              </div>

              {state === 'entering' && (
                <p aria-live="polite" className="mt-3 font-sans text-xs text-ink/65">
                  A cikk betöltése folyamatban van…
                </p>
              )}
            </>
          )}

          <p className="mt-6 border-t border-line pt-4 font-sans text-xs leading-relaxed text-ink/60">
            Jogi háttér: a kiskorúak védelme az audiovizuális médiaszolgáltatásokról szóló
            2010/13/EU irányelv 12. cikke és a magyar médiaszabályozás (2010. évi CLXXXV. törvény)
            alapján. A korhatár-ellenőrzés a böngésződben történik: a döntést egy süti tárolja
            (30 napig), személyes adatot nem gyűjtünk és nem továbbítunk. Részletek:{' '}
            <Link href="/rolunk" className="font-medium text-teal-700 hover:underline">
              a szerkesztőségről
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
