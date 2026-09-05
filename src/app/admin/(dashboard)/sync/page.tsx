import type { Metadata } from 'next';
import SyncPanel from '@/components/admin/SyncPanel';

export const metadata: Metadata = { title: 'Automatizált szinkron' };

export default function AdminSyncPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Automatizált szinkron</h1>
        <p className="font-body text-sm text-ink/50">Allegro termékadatok + Gemini cikkgenerálás</p>
      </div>
      <div className="mt-6">
        <SyncPanel />
      </div>
    </div>
  );
}
