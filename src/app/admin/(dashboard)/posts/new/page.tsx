import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getAllTags } from '@/lib/data';
import PostForm from '@/components/admin/PostForm';

export const metadata: Metadata = { title: 'Új bejegyzés' };

export default async function NewPostPage() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    getAllTags(),
  ]);

  return <PostForm categories={categories} allTagNames={tags.map((t) => t.name)} />;
}
