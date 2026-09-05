import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { ensureUniquePostSlug, resolveTagIds } from '@/lib/data';
import { postSchema } from '@/lib/validation';

type Params = { params: { id: string } };

export async function PUT(request: NextRequest, { params }: Params) {
  const existing = await prisma.post.findUnique({ where: { id: params.id }, include: { category: true } });
  if (!existing) {
    return NextResponse.json({ error: 'A bejegyzés nem található.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Érvénytelen adatok.' }, { status: 400 });
  }

  const data = parsed.data;
  const baseSlug = slugify(data.slug || data.title);
  const slug = await ensureUniquePostSlug(baseSlug, existing.id);

  const categoryId = data.categoryId || existing.categoryId;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: 'A választott kategória nem található.' }, { status: 400 });
  }

  const tagIds = await resolveTagIds(data.tags);

  const willBePublished = data.status === 'PUBLISHED';
  const publishedAt = willBePublished ? existing.publishedAt || new Date() : null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.postTag.deleteMany({ where: { postId: existing.id } });
    return tx.post.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt,
        content: data.content,
        coverImage: data.coverImage || null,
        coverImageAlt: data.coverImageAlt || null,
        categoryId: category.id,
        status: data.status,
        publishedAt,
        productName: data.productName || null,
        productBrand: data.productBrand || null,
        rating: data.rating ?? null,
        pros: JSON.stringify(data.pros),
        cons: JSON.stringify(data.cons),
        verdict: data.verdict || null,
        affiliateUrl: data.affiliateUrl || null,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        ogImage: data.ogImage || null,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
  });

  revalidatePath('/');
  revalidatePath(`/blog/${existing.slug}`);
  if (updated.slug !== existing.slug) revalidatePath(`/blog/${updated.slug}`);
  revalidatePath(`/kategoria/${existing.category.slug}`);
  if (category.slug !== existing.category.slug) revalidatePath(`/kategoria/${category.slug}`);
  revalidatePath('/sitemap.xml');

  return NextResponse.json({ ok: true, id: updated.id, slug: updated.slug });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const existing = await prisma.post.findUnique({ where: { id: params.id }, include: { category: true } });
  if (!existing) {
    return NextResponse.json({ error: 'A bejegyzés nem található.' }, { status: 404 });
  }

  await prisma.post.delete({ where: { id: params.id } });

  revalidatePath('/');
  revalidatePath(`/blog/${existing.slug}`);
  revalidatePath(`/kategoria/${existing.category.slug}`);
  revalidatePath('/sitemap.xml');

  return NextResponse.json({ ok: true });
}
