// Brute-force védelem a login végponthoz (per-process, memóriában).
// Szabály: e-mail címenként + IP-nként 5 sikertelen próbálkozás után
// 15 perces tiltás. Sikeres belépés nullázza a számlálót.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 perc figyelési ablak + tiltás

type Record = { count: number; firstAt: number; blockedUntil: number };

const attempts = new Map<string, Record>();

function key(ip: string, email: string): string {
  return `${ip} | ${email.toLowerCase().trim()}`;
}

function prune(now: number) {
  for (const [k, r] of attempts) {
    if (now > r.blockedUntil && now - r.firstAt > WINDOW_MS) attempts.delete(k);
  }
  // Memória-korlát: extrém esetben a legrégebbieket dobjuk
  if (attempts.size > 5000) {
    const oldest = [...attempts.entries()].sort((a, b) => a[1].firstAt - b[1].firstAt);
    for (const [k] of oldest.slice(0, 1000)) attempts.delete(k);
  }
}

export function loginKey(ip: string | null, email: string): string {
  return key(ip || 'ismeretlen-ip', email || '');
}

// Tiltva van-e most? Ha igen, hány ms múlva jár le.
export function isBlocked(keyStr: string): { blocked: boolean; retryInMs: number } {
  prune(Date.now());
  const r = attempts.get(keyStr);
  if (!r) return { blocked: false, retryInMs: 0 };
  const now = Date.now();
  if (now < r.blockedUntil) return { blocked: true, retryInMs: r.blockedUntil - now };
  // Ablak lejárt tiltás nélkül -> tiszta lap
  if (now - r.firstAt > WINDOW_MS) {
    attempts.delete(keyStr);
    return { blocked: false, retryInMs: 0 };
  }
  return { blocked: false, retryInMs: 0 };
}

// Sikertelen próbálkozás rögzítése. Igaz, ha EZZEL a próbálkozással lépett életbe a tiltás.
export function recordFailure(keyStr: string): { nowBlocked: boolean; retryInMs: number } {
  const now = Date.now();
  prune(now);
  let r = attempts.get(keyStr);
  if (!r || now - r.firstAt > WINDOW_MS) {
    r = { count: 0, firstAt: now, blockedUntil: 0 };
    attempts.set(keyStr, r);
  }
  r.count += 1;
  if (r.count >= MAX_ATTEMPTS) {
    r.blockedUntil = now + WINDOW_MS;
    return { nowBlocked: true, retryInMs: WINDOW_MS };
  }
  return { nowBlocked: false, retryInMs: 0 };
}

export function recordSuccess(keyStr: string) {
  attempts.delete(keyStr);
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim().slice(0, 60);
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim().slice(0, 60);
  return 'ismeretlen-ip';
}
