import { NextRequest, NextResponse } from 'next/server';
import { getLinkCheckWorker } from '@/lib/linkCheckWorker';
import { setLinkCheckSchedule } from '@/lib/linkCheckScheduler';
import { workersDisabled } from '@/lib/workerGuard';
import { prisma } from '@/lib/prisma';
import { getRateLimitStatus, getApiKeyStatuses } from '@/lib/gemini';

// POST /api/admin/linkcheck/control { action: "start" | "stop" | "pause" | "resume" | "rebuild" }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const action = body?.action as string;
  const worker = getLinkCheckWorker();

  switch (action) {
    case 'start': {
      // force:true - a rate limit miatti várakozást átugorja (kényszerített indítás)
      const msg = await worker.start(body?.force === true);
      return NextResponse.json({ ok: true, message: msg });
    }
    case 'stop': {
      const msg = await worker.stop();
      return NextResponse.json({ ok: true, message: msg });
    }
    case 'pause': {
      const msg = await worker.pause();
      return NextResponse.json({ ok: true, message: msg });
    }
    case 'resume': {
      const msg = await worker.resume();
      return NextResponse.json({ ok: true, message: msg });
    }
    case 'rebuild': {
      const state = await prisma.linkCheckState.findUnique({ where: { id: 'global' } });
      if (worker.isRunning() || state?.running) {
        return NextResponse.json({ error: 'Állítsd le a folyamatot a lista újraépítése előtt.' }, { status: 400 });
      }
      const msg = await worker.rebuild();
      return NextResponse.json({ ok: true, message: msg });
    }
    case 'schedule': {
      const enabled = body?.enabled;
      if (typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'Hiányzó enabled (boolean) paraméter.' }, { status: 400 });
      }
      const msg = await setLinkCheckSchedule(enabled);
      return NextResponse.json({ ok: true, message: msg });
    }
    default:
      return NextResponse.json({ error: 'Ismeretlen action. (start|stop|pause|resume|rebuild|schedule)' }, { status: 400 });
  }
}

// GET /api/admin/linkcheck/control - rate limit állapot + worker fut-e
export async function GET() {
  const rl = getRateLimitStatus();
  const worker = getLinkCheckWorker();
  const state = await prisma.linkCheckState.findUnique({ where: { id: 'global' } });
  return NextResponse.json({
    workerRunning: worker.isRunning(),
    dbRunning: state?.running ?? false,
    workersDisabled: workersDisabled(),
    rateLimit: rl,
    geminiKeys: await getApiKeyStatuses(),
  });
}