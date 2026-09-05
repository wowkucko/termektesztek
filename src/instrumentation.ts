// A szerver indításakor egyszer fut le (Node.js runtime), elindítja a
// link-ellenőrző ütemezőt. A szinkron-workerhez hasonlóan in-process fut,
// ami a PM2-es VPS telepítésnél megbízhatóan működik.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startLinkCheckScheduler } = await import('@/lib/linkCheckScheduler');
    startLinkCheckScheduler();
  }
}