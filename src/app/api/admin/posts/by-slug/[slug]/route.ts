import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { resolveTagIds } from '@/lib/data';
import { postSchema } from '@/lib/validation';

// PUT /api/admin/posts/by-slug/[slug] - cikk frissítése slug alapján.
// A push to live frissítési ágához: a távoli DB-azonosítók itthon ismeretlenek,
// ezért slug (unique) alapján azonosítunk. Viselkedése megegyezik az ID-s PUT-tal.
export async function PUT(request: NextRequest, { params }: { params: { slug: string } }) {
  const existing = await prisma.post.findUnique({
    where: { slug: params.slug },
    include: { category: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'A bejegyzés nem található.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Érvénytelen adatok.' }, { status: 400 });
  }

  const data = parsed.data;
  const tagIds = await resolveTagIds(data.tags);

  const category = data.categoryId
    ? await prisma.category.findUnique({ where: { id: data.categoryId } })
    : data.categorySlug
      ? await prisma.category.findUnique({ where: { slug: data.categorySlug } })
      : existing.category;
  if (!category) {
    return NextResponse.json({ error: 'A választott kategória nem található.' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.postTag.deleteMany({ where: { postId: existing.id } });
    return tx.post.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        coverImage: data.coverImage || null,
        coverImageAlt: data.coverImageAlt || null,
        categoryId: category.id,
        status: data.status,
        publishedAt: data.status === 'PUBLISHED' ? existing.publishedAt || new Date() : null,
        productName: data.productName || null,
        productBrand: data.productBrand || null,
        priceFt: data.priceFt ?? null,
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
  revalidatePath(`/kategoria/${existing.category.slug}`);
  if (category.slug !== existing.category.slug) revalidatePath(`/kategoria/${category.slug}`);
  revalidatePath('/sitemap.xml');

  return NextResponse.json({ ok: true, id: updated.id, slug: updated.slug });
}
