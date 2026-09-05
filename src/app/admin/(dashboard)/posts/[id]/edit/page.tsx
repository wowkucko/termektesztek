import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAllTags, getPostForEdit } from '@/lib/data';
import PostForm, { type PostFormInitial } from '@/components/admin/PostForm';

export const metadata: Metadata = { title: 'Bejegyzés szerkesztése' };

type Props = { params: { id: string } };

export default async function EditPostPage({ params }: Props) {
  const [post, categories, tags] = await Promise.all([
    getPostForEdit(params.id),
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    getAllTags(),
  ]);

  if (!post) notFound();

  const initial: PostFormInitial = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage,
    coverImageAlt: post.coverImageAlt,
    categoryId: post.categoryId,
    tags: post.tags.map((t) => t.tag.name),
    status: post.status as 'DRAFT' | 'PUBLISHED',
    productName: post.productName,
    productBrand: post.productBrand,
    rating: post.rating,
    pros: post.pros,
    cons: post.cons,
    verdict: post.verdict,
    affiliateUrl: post.affiliateUrl,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    ogImage: post.ogImage,
  };

  return <PostForm categories={categories} allTagNames={tags.map((t) => t.name)} initial={initial} />;
}
