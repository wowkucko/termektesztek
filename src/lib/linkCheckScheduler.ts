import 'server-only';
import { prisma } from '@/lib/prisma';
import { getLinkCheckWorker } from '@/lib/linkCheckWorker';
import { workersDisabled } from '@/lib/workerGuard';

// In-process ütemező: a szerver indításakor (instrumentation.ts) elindul, és
// alapértelmezetten hetente elindítja a link-ellenőrzést. A következő futás
// időpontja az adatbázisban van (LinkCheckState.nextRunAt), így újraindítás
// után sem csúszik el a ciklus.

const DEFAULT_INTERVAL_HOURS = 168; // hetente
const TICK_MS = 60_000; // percenként ellenőrizzük, hogy esedékes-e

const g = globalThis as unknown as { __linkCheckScheduler?: { timer: NodeJS.Timeout | null } };

function envIntervalHours(): number {
  const raw = parseInt(process.env.LINKCHECK_SCHEDULE_INTERVAL_HOURS || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_HOURS;
}

// Alapértelmezett bekapcsoltság: prod-ban igen, dev-ben csak ha kifejezetten kérik.
function envDefaultEnabled(): boolean {
  const raw = process.env.LINKCHECK_SCHEDULE_ENABLED?.toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function startLinkCheckScheduler(): void {
  if (g.__linkCheckScheduler?.timer) return; // már fut
  g.__linkCheckScheduler = { timer: null };

  const timer = setInterval(() => {
    tick().catch(() => {});
  }, TICK_MS);
  if (typeof timer.unref === 'function') timer.unref();
  g.__linkCheckScheduler.timer = timer;

  // Induláskor beállítjuk a következő futást, ha még nincs
  tick().catch(() => {});
}

async function tick() {
  const state = await prisma.linkCheckState.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global' },
  });

  const enabled = !workersDisabled() && (state.scheduleEnabled ?? envDefaultEnabled());
  const intervalHours = envIntervalHours();
  const now = new Date();

  // Első futás: csak beállítjuk a következő időpontot
  if (!state.nextRunAt) {
    await prisma.linkCheckState.update({
      where: { id: 'global' },
      data: { nextRunAt: new Date(now.getTime() + intervalHours * 3600_000) },
    });
    return;
  }

  if (!enabled) return;
  if (state.nextRunAt > now) return;

  // Esedékes - előbb toljuk a következőt (re-entry védelem), aztán indulhat a futás
  await prisma.linkCheckState.update({
    where: { id: 'global' },
    data: { nextRunAt: new Date(now.getTime() + intervalHours * 3600_000) },
  });

  const worker = getLinkCheckWorker();
  if (worker.isRunning() || state.running || state.rateLimited) {
    // Már fut (kézi vagy ütemezett), vagy rate limit van: a ciklus tolódik
    return;
  }

  const msg = await worker.start();
  await prisma.linkCheckState
    .update({
      where: { id: 'global' },
      data: {
        log: `[${new Date().toISOString().slice(11, 19)}] Ütemezett futás: ${msg}\n${
          (await prisma.linkCheckState.findUnique({ where: { id: 'global' } }))?.log || ''
        }`.slice(0, 5000),
      },
    })
    .catch(() => {});
}

// A panel "Ütemezés" kapcsolójához: explicit be/ki, és ha bekapcsoljuk,
// azonnal beállítjuk a következő futást, ha még nincs.
export async function setLinkCheckSchedule(enabled: boolean): Promise<string> {
  await prisma.linkCheckState.upsert({
    where: { id: 'global' },
    update: { scheduleEnabled: enabled },
    create: { id: 'global', scheduleEnabled: enabled },
  });
  const state = await prisma.linkCheckState.findUnique({ where: { id: 'global' } });
  if (enabled && !state?.nextRunAt) {
    await prisma.linkCheckState.update({
      where: { id: 'global' },
      data: { nextRunAt: new Date(Date.now() + envIntervalHours() * 3600_000) },
    });
  }
  return enabled ? 'Ütemezett futás bekapcsolva.' : 'Ütemezett futás kikapcsolva.';
}