import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { ensureUniqueCategorySlug } from '@/lib/data';
import { categorySchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Érvénytelen adatok.' }, { status: 400 });
  }

  const data = parsed.data;
  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) {
    return NextResponse.json({ error: 'Már létezik ilyen nevű kategória.' }, { status: 400 });
  }

  const baseSlug = slugify(data.slug || data.name);
  const slug = await ensureUniqueCategorySlug(baseSlug);

  const category = await prisma.category.create({
    data: { name: data.name, slug, description: data.description || null },
  });

  revalidatePath('/');
  return NextResponse.json({ ok: true, id: category.id }, { status: 201 });
}
