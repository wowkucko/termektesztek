import 'server-only';

// Éles mód kapcsoló: WORKERS_DISABLED=true esetén a háttér-workerek
// (szinkron, link-ellenőrzés) és az ütemező NEM indíthatók el.
// A push-munkafolyamathoz való: az éles szerveren csak a web fut,
// a szinkront az itthoni gép végzi, az eredményt a push-script tölti fel.
// Alapértelmezett (nincs beállítva): a workerek indíthatók (itthoni gép).
export function workersDisabled(): boolean {
  const raw = (process.env.WORKERS_DISABLED || '').toLowerCase().trim();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export const WORKERS_DISABLED_MESSAGE =
  'A workerek ezen a szerveren le vannak tiltva (WORKERS_DISABLED=true). ' +
  'A szinkront az itthoni gépen futtasd, az eredményt a push-scripttel töltsd fel (npm run push).';
