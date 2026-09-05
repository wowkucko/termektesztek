// Tiszta szerver komponens: a megosztó linkek sima <a href> elemek,
// semmilyen interakcióhoz nem kell kliens JS — így nulla bájt JS-t adnak
// az oldalhoz (korábban 'use client' volt, és hidratálódott).
export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = [
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { name: 'E-mail', href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}` },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
      <span className="w-full text-ink/50">Megosztás:</span>
      {links.map((link) => (
        <a
          key={link.name}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-chip border border-ink/15 px-2.5 py-1.5 text-xs text-ink/70 transition-colors hover:border-teal-500 hover:text-teal-600"
        >
          {link.name}
        </a>
      ))}
    </div>
  );
}
