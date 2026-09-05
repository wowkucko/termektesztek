import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import DeleteButton from '@/components/admin/DeleteButton';

export const metadata: Metadata = { title: 'Hozzászólások' };

export default async function AdminCommentsPage() {
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { post: { select: { title: true, slug: true } } },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">
        Hozzászólások <span className="font-sans text-sm font-normal text-ink/40">({comments.length})</span>
      </h1>
      <p className="mt-2 font-body text-sm text-ink/55">
        Az új hozzászólások automatikusan megjelennek (honeypot + duplikátum-védelemmel).
        Kéretlen tartalmat itt törölhetsz.
      </p>

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-white">
        {comments.length === 0 ? (
          <p className="p-6 font-body text-sm text-ink/60">Még nincs hozzászólás.</p>
        ) : (
          <ul className="divide-y divide-line">
            {comments.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm">
                  <span className="font-semibold text-ink">{c.author}</span>
                  {c.rating != null && <span className="text-signal">{'★'.repeat(c.rating)}</span>}
                  <span className="text-xs text-ink/40">
                    {new Date(c.createdAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <Link
                    href={`/blog/${c.post.slug}`}
                    target="_blank"
                    className="text-xs text-teal-600 hover:underline"
                  >
                    {c.post.title.slice(0, 60)} ↗
                  </Link>
                  <span className="ml-auto">
                    <DeleteButton
                      endpoint={`/api/admin/comments/${c.id}`}
                      confirmMessage="Biztosan törlöd ezt a hozzászólást?"
                    />
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap font-body text-sm text-ink/75">{c.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
