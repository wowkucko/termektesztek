import type { Metadata } from 'next';
import { getAllCategoriesForAdmin } from '@/lib/data';
import CategoryManager from '@/components/admin/CategoryManager';

export const metadata: Metadata = { title: 'Kategóriák' };

export default async function AdminCategoriesPage() {
  const categories = await getAllCategoriesForAdmin();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Kategóriák</h1>
      <div className="mt-6">
        <CategoryManager categories={categories} />
      </div>
    </div>
  );
}
