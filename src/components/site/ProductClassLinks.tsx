import Link from 'next/link';

/**
 * Termékosztály-toplisták linklistája (pl. "Legjobb air fryer").
 *
 * Kategória- és cikkoldalakon jelenik meg: a "legjobb X" hubokra mutató belső
 * linkek azért fontosak, mert a kereslet valójában termékosztály-szinten van
 * ("legjobb air fryer 40 ezer alatt"), a kategórianév viszont nem keresett.
 */
export default function ProductClassLinks({
  heading,
  intro,
  links,
  className,
}: {
  heading: string;
  intro?: string;
  links: { href: string; label: string }[];
  className?: string;
}) {
  if (links.length === 0) return null;

  return (
    <section
      className={[
        'not-prose rounded-card border border-line bg-white p-5',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-teal-700">{heading}</p>
      {intro && <p className="mt-2 font-body text-sm leading-relaxed text-ink/70">{intro}</p>}
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex items-center gap-1.5 rounded-chip border border-ink/15 bg-white px-3 py-1.5 font-sans text-sm text-ink transition-colors hover:border-teal-500 hover:text-teal-600"
            >
              <span aria-hidden="true" className="text-signal-600">
                🏆
              </span>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
