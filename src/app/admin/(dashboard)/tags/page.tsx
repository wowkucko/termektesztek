import type { Metadata } from 'next';
import { getAllTags } from '@/lib/data';
import TagManager from '@/components/admin/TagManager';

export const metadata: Metadata = { title: 'Címkék' };

export default async function AdminTagsPage() {
  const tags = await getAllTags();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Címkék</h1>
      <div className="mt-6">
        <TagManager tags={tags} />
      </div>
    </div>
  );
}
