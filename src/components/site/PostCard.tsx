import Link from 'next/link';
import Image from 'next/image';
import type { PostWithRelations } from '@/lib/data';
import { formatDate } from '@/lib/utils';
import { RatingBadge } from './VerdictStamp';

export default function PostCard({ post, priority = false }: { post: PostWithRelations; priority?: boolean }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-line bg-white transition-shadow hover:shadow-card">
      <Link href={`/blog/${post.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-teal-50">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.coverImageAlt || post.title}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-4xl text-teal-200">
            {post.category.name.charAt(0)}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/kategoria/${post.category.slug}`}
            className="w-fit rounded-chip bg-teal-50 px-2.5 py-1 font-sans text-xs font-semibold text-teal-700"
          >
            {post.category.name}
          </Link>
          {post.rating != null && <RatingBadge rating={post.rating} size="sm" />}
        </div>

        <Link href={`/blog/${post.slug}`}>
          <h3 className="font-display text-lg font-semibold leading-snug text-ink group-hover:text-teal-600">
            {post.title}
          </h3>
        </Link>

        <p className="line-clamp-2 font-body text-sm leading-relaxed text-ink/65">{post.excerpt}</p>

        <div className="mt-auto pt-2 font-sans text-xs text-ink/45">
          {post.publishedAt ? formatDate(post.publishedAt) : ''}
        </div>
      </div>
    </article>
  );
}
