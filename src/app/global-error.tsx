'use client';

// Globális hibahatár: a szerveroldali renderelési hibákat itt fogjuk.
// A noindex itt nem Metaadat-API-ból jön (a hibakomponens ügyféloldali),
// hanem a Google ilyenkor a státuszkódból (500) tudja, hogy nem indexelendő.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="hu">
      <body>
        <div
          style={{
            minHeight: '50vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '5rem 1rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: '3.5rem', fontWeight: 700, color: '#E8542A', margin: 0 }}>500</p>
          <h1 style={{ fontSize: '1.5rem', color: '#12191A', marginTop: '1rem' }}>
            Valami hiba történt
          </h1>
          <p style={{ color: '#12191A99', marginTop: '0.75rem', maxWidth: '28rem' }}>
            A kérés feldolgozása közben hiba keletkezett. Próbáld újra — ha többször is
            előfordul, írj nekünk a kapcsolat oldalon.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: '#0E6E63',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Újrapróbálom
          </button>
        </div>
      </body>
    </html>
  );
}
