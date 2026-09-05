import type { Metadata } from 'next';
import LinkCheckPanel from '@/components/admin/LinkCheckPanel';

export const metadata: Metadata = { title: 'Link-ellenőrzés' };

export default function AdminLinkCheckPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Link-ellenőrzés</h1>
        <p className="font-body text-sm text-ink/50">Allegro affiliate linkek frissessége, automatikus cserével</p>
      </div>
      <div className="mt-6">
        <LinkCheckPanel />
      </div>
    </div>
  );
}