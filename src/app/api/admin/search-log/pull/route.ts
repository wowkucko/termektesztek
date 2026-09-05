import { NextResponse } from 'next/server';
import { pullSearchLogs } from '@/lib/searchLogPull';

// POST /api/admin/search-log/pull - éles keresési napló lehúzása itthonra
export async function POST() {
  const result = await pullSearchLogs();
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...result });
}
