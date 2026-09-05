import { NextRequest, NextResponse } from 'next/server';
import { getSyncWorker } from '@/lib/syncWorker';
import { prisma } from '@/lib/prisma';
import { getRateLimitStatus, getApiKeyStatuses } from '@/lib/gemini';
import { workersDisabled } from '@/lib/workerGuard';

// POST /api/admin/sync/control { action: "start" | "stop" | "pause" | "resume" }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const action = body?.action as string;
  const worker = getSyncWorker();

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
    default:
      return NextResponse.json({ error: 'Ismeretlen action. (start|stop|pause|resume)' }, { status: 400 });
  }
}

// GET /api/admin/sync/control - rate limit állapot + worker fut-e
export async function GET() {
  const rl = getRateLimitStatus();
  const worker = getSyncWorker();
  const state = await prisma.syncState.findUnique({ where: { id: 'global' } });
  return NextResponse.json({
    workerRunning: worker.isRunning(),
    dbRunning: state?.running ?? false,
    workersDisabled: workersDisabled(),
    rateLimit: rl,
    geminiKeys: await getApiKeyStatuses(),
  });
}
