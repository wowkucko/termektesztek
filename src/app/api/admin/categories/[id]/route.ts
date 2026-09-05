import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { ensureUniqueCategorySlug } from '@/lib/data';
import { categorySchema } from '@/lib/validation';

type Params = { params: { id: string } };

export async function PUT(request: NextRequest, { params }: Params) {
  const existing = await prisma.category.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'A kategória nem található.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Érvénytelen adatok.' }, { status: 400 });
  }

  const data = parsed.data;
  const baseSlug = slugify(data.slug || data.name);
  const slug = await ensureUniqueCategorySlug(baseSlug, existing.id);

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: { name: data.name, slug, description: data.description || null },
  });

  revalidatePath('/');
  revalidatePath(`/kategoria/${existing.slug}`);
  if (updated.slug !== existing.slug) revalidatePath(`/kategoria/${updated.slug}`);

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const existing = await prisma.category.findUnique({
    where: { id: params.id },
    include: { _count: { select: { posts: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'A kategória nem található.' }, { status: 404 });
  }

  if (existing._count.posts > 0) {
    return NextResponse.json(
      { error: `Nem törölhető: ${existing._count.posts} bejegyzés tartozik ehhez a kategóriához. Előbb helyezd át vagy töröld azokat.` },
      { status: 400 }
    );
  }

  await prisma.category.delete({ where: { id: params.id } });
  revalidatePath('/');
  return NextResponse.json({ ok: true });
}
