import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { ensureUniqueTagSlug } from '@/lib/data';
import { tagSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = tagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Érvénytelen adatok.' }, { status: 400 });
  }

  const data = parsed.data;
  const existing = await prisma.tag.findUnique({ where: { name: data.name } });
  if (existing) {
    return NextResponse.json({ error: 'Már létezik ilyen nevű címke.' }, { status: 400 });
  }

  const baseSlug = slugify(data.slug || data.name);
  const slug = await ensureUniqueTagSlug(baseSlug);

  const tag = await prisma.tag.create({ data: { name: data.name, slug } });

  revalidatePath('/');
  return NextResponse.json({ ok: true, id: tag.id }, { status: 201 });
}
