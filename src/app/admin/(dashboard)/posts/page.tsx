import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllPostsForAdmin, getPostsMissingImages } from '@/lib/data';
import { formatDate } from '@/lib/utils';
import DeleteButton from '@/components/admin/DeleteButton';

export const metadata: Metadata = { title: 'Bejegyzések' };

export default async function AdminPostsPage() {
  const [posts, missingImages] = await Promise.all([getAllPostsForAdmin(), getPostsMissingImages()]);
  const missingImageIds = new Set(missingImages.map((post) => post.id));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Bejegyzések</h1>
        <Link href="/admin/posts/new" className="btn-primary">
          + Új bejegyzés
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-white">
        {posts.length === 0 ? (
          <p className="p-6 font-body text-sm text-ink/60">Még nincs bejegyzés.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line font-sans text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-3 font-medium">Cím</th>
                <th className="px-5 py-3 font-medium">Kategória</th>
                <th className="px-5 py-3 font-medium">Állapot</th>
                <th className="px-5 py-3 font-medium">Frissítve</th>
                <th className="px-5 py-3 font-medium text-right">Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {posts.map((post) => (
                <tr key={post.id} className="font-sans text-sm">
                  <td className="px-5 py-4">
                    <Link href={`/admin/posts/${post.id}/edit`} className="font-medium text-ink hover:text-teal-600">
                      {post.title}
                    </Link>
                    {post.rating != null && (
                      <span className="ml-2 rounded-chip bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                        {post.rating.toFixed(1)}/10
                      </span>
                    )}
                    {missingImageIds.has(post.id) && (
                      <span
                        title="Borítókép és/vagy szövegközi kép hiányzik"
                        className="ml-2 rounded-chip border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700"
                      >
                        Kép nélkül
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-ink/60">{post.category.name}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-chip px-2.5 py-1 text-xs font-semibold ${
                        post.status === 'PUBLISHED' ? 'bg-pro/10 text-pro' : 'bg-ink/10 text-ink/60'
                      }`}
                    >
                      {post.status === 'PUBLISHED' ? 'Publikált' : 'Piszkozat'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink/50">{formatDate(post.updatedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-4">
                      <Link href={`/admin/posts/${post.id}/edit`} className="font-medium text-teal-600 hover:text-teal-700">
                        Szerkesztés
                      </Link>
                      <DeleteButton
                        endpoint={`/api/admin/posts/${post.id}`}
                        confirmMessage={`Biztosan törlöd a(z) "${post.title}" bejegyzést? Ez nem vonható vissza.`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
