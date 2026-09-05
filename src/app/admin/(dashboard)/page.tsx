import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getAllPostsForAdmin, getPostsMissingImages } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default async function AdminDashboardPage() {
  const [totalPosts, published, drafts, totalCategories, totalTags, recentPosts, missingImages] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.post.count({ where: { status: 'DRAFT' } }),
    prisma.category.count(),
    prisma.tag.count(),
    getAllPostsForAdmin().then((posts) => posts.slice(0, 6)),
    getPostsMissingImages(),
  ]);

  const stats = [
    { label: 'Összes bejegyzés', value: totalPosts },
    { label: 'Publikált', value: published },
    { label: 'Piszkozat', value: drafts },
    { label: 'Kategória', value: totalCategories },
    { label: 'Címke', value: totalTags },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Áttekintés</h1>
        <Link href="/admin/posts/new" className="btn-primary">
          + Új bejegyzés
        </Link>
      </div>

      {missingImages.length > 0 && (
        <div className="mt-8 rounded-card border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="font-display text-lg font-bold text-ink">Kép nélküli cikkek</h2>
            <span className="rounded-chip bg-amber-500/20 px-2.5 py-0.5 font-sans text-xs font-bold text-amber-700">
              {missingImages.length} db
            </span>
          </div>
          <p className="mt-1 font-body text-sm text-ink/70">
            {missingImages.length === 1 ? 'Ennél a publikált bejegyzésnél' : 'Ezeknél a publikált bejegyzéseknél'} hiányzik a
            borítókép vagy a szövegközi kép – a találati listán és a megosztásoknál is rosszul mutatnak.
          </p>
          <div className="mt-4 divide-y divide-line rounded-card border border-line bg-white">
            {missingImages.slice(0, 8).map((post) => (
              <Link
                key={post.id}
                href={`/admin/posts/${post.id}/edit`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-paper/60"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="truncate font-sans text-sm font-semibold text-ink">{post.title}</span>
                  {!post.hasCover && (
                    <span className="rounded-chip bg-amber-500/10 px-2 py-0.5 font-sans text-xs font-semibold text-amber-600">
                      Nincs borítókép
                    </span>
                  )}
                  {post.contentImageCount === 0 && (
                    <span className="rounded-chip bg-amber-500/10 px-2 py-0.5 font-sans text-xs font-semibold text-amber-600">
                      Nincs szövegközi kép
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-sans text-xs text-ink/45">
                  {formatDate(post.publishedAt ?? post.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/admin/posts" className="mt-3 inline-block font-sans text-sm font-medium text-teal-600 hover:text-teal-700">
            Az összes bejegyzés listája →
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-card border border-line bg-white p-5">
            <p className="font-display text-2xl font-bold text-ink">{stat.value}</p>
            <p className="mt-1 font-sans text-xs text-ink/50">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-bold text-ink">Legutóbb szerkesztve</h2>
        <div className="mt-4 divide-y divide-line rounded-card border border-line bg-white">
          {recentPosts.length === 0 ? (
            <p className="p-5 font-body text-sm text-ink/60">
              Még nincs egyetlen bejegyzés sem. Hozd létre az elsőt!
            </p>
          ) : (
            recentPosts.map((post) => (
              <Link
                key={post.id}
                href={`/admin/posts/${post.id}/edit`}
                className="flex items-center justify-between gap-4 p-5 hover:bg-paper/60"
              >
                <div>
                  <p className="font-sans text-sm font-semibold text-ink">{post.title}</p>
                  <p className="mt-0.5 font-sans text-xs text-ink/45">
                    {post.category.name} · {formatDate(post.updatedAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-chip px-2.5 py-1 font-sans text-xs font-semibold ${
                    post.status === 'PUBLISHED' ? 'bg-pro/10 text-pro' : 'bg-ink/10 text-ink/60'
                  }`}
                >
                  {post.status === 'PUBLISHED' ? 'Publikált' : 'Piszkozat'}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
