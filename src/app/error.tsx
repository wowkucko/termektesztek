'use client';

// Szekciószintű hibahatár: a route-ok (pl. adatbázis-hiba) hibáit itt fogjuk
// meg, hogy a látogató ne a nyers hibaoldalt lássa. A noindexet a státuszkód
// (500) jelzi a keresőknek — klienskomponensből nem exportálható metadata.
export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center text-center py-20">
      <p className="font-display text-6xl font-bold text-signal">500</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">Valami hiba történt</h1>
      <p className="mt-3 max-w-md font-body text-ink/65">
        A kérés feldolgozása közben hiba keletkezett. Próbáld újra — ha többször is előfordul,
        írj nekünk a kapcsolat oldalon.
      </p>
      <button type="button" onClick={() => reset()} className="btn-primary mt-6">
        Újrapróbálom
      </button>
    </div>
  );
}
