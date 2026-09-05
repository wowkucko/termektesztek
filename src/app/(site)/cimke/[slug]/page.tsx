import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTagBySlug, getPublishedPosts } from '@/lib/data';
import { absoluteUrl } from '@/lib/seo';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import PostCard from '@/components/site/PostCard';
import Pagination from '@/components/site/Pagination';

export const revalidate = 3600;

const PAGE_SIZE = 12;

type Props = { params: { slug: string }; searchParams: { page?: string } };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const tag = await getTagBySlug(params.slug);
  if (!tag) return {};
  const page = Math.max(1, Number(searchParams.page) || 1);
  const title = `#${tag.name} címkéjű tesztek`;
  return {
    title,
    description: `Az összes bejegyzés, amit a(z) ${tag.name} címkével láttunk el.`,
    // A 2+ oldalak duplikált tartalom - ne indexeljük őket, de a linkeket kövessük
    robots: page > 1 ? { index: false, follow: true } : undefined,
    alternates: { canonical: absoluteUrl(`/cimke/${tag.slug}`) },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const tag = await getTagBySlug(params.slug);
  if (!tag) notFound();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const { posts, total } = await getPublishedPosts({
    tagSlug: tag.slug,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: 'Kezdőlap', href: '/' }, { name: `#${tag.name}` }]} />
      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">#{tag.name}</h1>

      <div className="mt-10">
        {posts.length === 0 ? (
          <p className="font-body text-ink/60">Ehhez a címkéhez még nincs publikált teszt.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath={`/cimke/${tag.slug}`} />
    </div>
  );
}
