import { prisma } from '@/lib/prisma';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// CDATA-törés: a "]]>" szöveg véget vetne a content:encoded szakasznak.
function escapeCdata(value: string): string {
  return value.replace(/]]>/g, ']]]]><![CDATA[>');
}

export async function GET() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    take: 30,
    select: {
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      publishedAt: true,
      category: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const rssUrl = absoluteUrl('/rss.xml');

  const items = posts
    .map((post) => {
      const link = absoluteUrl(`/blog/${post.slug}`);
      const categories = [
        post.category.name,
        ...post.tags.map(({ tag }) => tag.name),
      ]
        .map((name) => `      <category>${escapeXml(name)}</category>`)
        .join('\n');
      // Teljes szöveg a feed-olvasóknak (content:encoded) — a lezáró <script>
      // tartalmakat is ki kell szűrni, hogy a feed biztonságos maradjon.
      const body = post.content.replace(/<script[\s\S]*?<\/script>/gi, '');
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${(post.publishedAt ?? new Date()).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(SITE_NAME)}</dc:creator>
${categories}
      <content:encoded><![CDATA[${escapeCdata(body)}]]></content:encoded>
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>hu-hu</language>
    <generator>termektesztelo-blog</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${rssUrl}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
