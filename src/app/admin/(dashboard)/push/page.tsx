import type { Metadata } from 'next';
import PushPanel from '@/components/admin/PushPanel';

export const metadata: Metadata = { title: 'Push to live' };

export default function AdminPushPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Push to live</h1>
      <p className="mt-2 font-body text-sm text-ink/55">
        Az itthon legenerált cikkek feltöltése az éles blogra, egyetlen gombnyomásra.
      </p>
      <div className="mt-6">
        <PushPanel />
      </div>
    </div>
  );
}
