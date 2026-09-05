import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { clientIp, isBlocked, loginKey, recordFailure, recordSuccess } from '@/lib/loginThrottle';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Időzítés-orákulum ellen: nem létező e-mail esetén is futtatunk egy bcrypt
// összehasonlítást, hogy a válaszidő ne árulja el, létezik-e a fiók.
// (Előre legenerált hash, értéke lényegtelen.)
const DUMMY_HASH = '$2b$12$KIXxQGv9vH6p5qQ8vH6p5uIXxQGv9vH6p5qQ8vH6p5uIXxQGv9vH6p5';

function blockedResponse(retryInMs: number) {
  const mins = Math.max(1, Math.ceil(retryInMs / 60000));
  const res = NextResponse.json(
    { error: `Túl sok sikertelen próbálkozás. Próbáld újra kb. ${mins} perc múlva.` },
    { status: 429 }
  );
  res.headers.set('Retry-After', String(Math.ceil(retryInMs / 1000)));
  return res;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Hibás e-mail cím vagy jelszó formátum.' }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const throttleKey = loginKey(clientIp(request), email);

  const block = isBlocked(throttleKey);
  if (block.blocked) return blockedResponse(block.retryInMs);

  const fail = () => {
    const r = recordFailure(throttleKey);
    if (r.nowBlocked) return blockedResponse(r.retryInMs);
    return NextResponse.json({ error: 'Hibás e-mail cím vagy jelszó.' }, { status: 401 });
  };

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Időzítés-kiegyenlítés (lásd fent)
    await bcrypt.compare(password, DUMMY_HASH).catch(() => false);
    return fail();
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return fail();
  }

  recordSuccess(throttleKey);

  const token = await createSessionToken({ sub: user.id, email: user.email, name: user.name });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
