import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { ensureUniqueTagSlug } from '@/lib/data';
import { tagSchema } from '@/lib/validation';

type Params = { params: { id: string } };

export async function PUT(request: NextRequest, { params }: Params) {
  const existing = await prisma.tag.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'A címke nem található.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = tagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Érvénytelen adatok.' }, { status: 400 });
  }

  const data = parsed.data;
  const baseSlug = slugify(data.slug || data.name);
  const slug = await ensureUniqueTagSlug(baseSlug, existing.id);

  const updated = await prisma.tag.update({
    where: { id: existing.id },
    data: { name: data.name, slug },
  });

  revalidatePath('/');
  revalidatePath(`/cimke/${existing.slug}`);
  if (updated.slug !== existing.slug) revalidatePath(`/cimke/${updated.slug}`);

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const existing = await prisma.tag.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'A címke nem található.' }, { status: 404 });
  }

  await prisma.tag.delete({ where: { id: params.id } });
  revalidatePath('/');
  return NextResponse.json({ ok: true });
}
