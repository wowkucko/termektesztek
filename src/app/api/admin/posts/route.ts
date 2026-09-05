import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { ensureUniquePostSlug, resolveTagIds } from '@/lib/data';
import { postSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Érvénytelen adatok.' }, { status: 400 });
  }

  const data = parsed.data;
  const baseSlug = slugify(data.slug || data.title);
  const slug = await ensureUniquePostSlug(baseSlug);
  const tagIds = await resolveTagIds(data.tags);

  const category = data.categoryId
    ? await prisma.category.findUnique({ where: { id: data.categoryId } })
    : data.categorySlug
      ? await prisma.category.findUnique({ where: { slug: data.categorySlug } })
      : null;
  if (!category) {
    return NextResponse.json({ error: 'A választott kategória nem található.' }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      coverImage: data.coverImage || null,
      coverImageAlt: data.coverImageAlt || null,
      categoryId: category.id,
      status: data.status,
      publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
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

  revalidatePath('/');
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath(`/kategoria/${category.slug}`);
  revalidatePath('/sitemap.xml');

  return NextResponse.json({ ok: true, id: post.id, slug: post.slug }, { status: 201 });
}
