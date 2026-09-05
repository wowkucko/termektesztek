import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

// POST /api/comments - új olvasói komment (publikus, auto-jóváhagyott).
// Spam-védelem: honeypot mező + duplikátum-gát (ugyanaz a szöveg 10 percen belül).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const postId = typeof body?.postId === 'string' ? body.postId : '';
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const author = typeof body?.author === 'string' ? body.author.trim().slice(0, 40) : '';
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  const ratingRaw = body?.rating;
  const rating =
    typeof ratingRaw === 'number' && Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
      ? ratingRaw
      : null;

  // Honeypot: botok töltik ki - ilyenkor csendben "sikert" adunk, de nem mentünk
  if (typeof body?.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  if (!postId || author.length < 2) {
    return NextResponse.json({ error: 'Add meg a neved (min. 2 karakter).' }, { status: 400 });
  }
  if (text.length < 5) {
    return NextResponse.json({ error: 'A hozzászólás túl rövid (min. 5 karakter).' }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, slug: true, status: true } });
  if (!post || post.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'A cikk nem található.' }, { status: 404 });
  }

  const recentDup = await prisma.comment.findFirst({
    where: { postId, text, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    select: { id: true },
  });
  if (recentDup) {
    return NextResponse.json({ error: 'Ezt már elküldted - kis türelmet.' }, { status: 429 });
  }

  const comment = await prisma.comment.create({
    data: { postId, author, rating, text },
    select: { id: true, author: true, rating: true, text: true, createdAt: true },
  });

  if (slug && slug === post.slug) {
    revalidatePath(`/blog/${slug}`);
  }

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
