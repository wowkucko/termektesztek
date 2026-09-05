import Link from 'next/link';
import { getAllCategories } from '@/lib/data';
import { SITE_NAME } from '@/lib/seo';

export default async function Footer() {
  const categories = await getAllCategories();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-signal" aria-hidden="true" />
            <span className="font-display text-lg font-bold text-ink">{SITE_NAME}</span>
          </div>
          <p className="mt-3 max-w-sm font-body text-sm leading-relaxed text-ink/65">
            Magyar nyelvű terméktesztek számos kategóriában, az internetről összegyűjtött vásárlói
            vélemények alapján. Átlátható összehasonlításokkal és értékelésekkel segítünk
            megtalálni a neked legjobban megfelelő terméket. A cikkeinkben található vásárlási
            linkek egy része partnerlink lehet: ha ezekből vásárolsz, jutalékot kaphatunk, ez
            azonban nem befolyásolja az értékeléseinket.
          </p>
        </div>

        <div>
          <h3 className="font-sans text-sm font-semibold text-ink">Kategóriák</h3>
          <ul className="mt-3 space-y-2 font-sans text-sm text-ink/65">
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link href={`/kategoria/${cat.slug}`} className="hover:text-teal-600">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-sans text-sm font-semibold text-ink">Oldal</h3>
          <ul className="mt-3 space-y-2 font-sans text-sm text-ink/65">
            <li>
              <Link href="/" className="hover:text-teal-600">Kezdőlap</Link>
            </li>
            <li>
              <Link href="/kereses" className="hover:text-teal-600">Keresés</Link>
            </li>
            <li>
              <Link href="/karacsony" className="hover:text-teal-600">Karácsonyi ötletek</Link>
            </li>
            <li>
              <Link href="/black-friday" className="hover:text-teal-600">Black Friday</Link>
            </li>
            <li>
              <Link href="/rolunk" className="hover:text-teal-600">Rólunk</Link>
            </li>
            <li>
              <Link href="/kapcsolat" className="hover:text-teal-600">Kapcsolat</Link>
            </li>
            <li>
              <Link href="/affiliate-tajekoztato" className="hover:text-teal-600">Affiliate tájékoztató</Link>
            </li>
            <li>
              <Link href="/sitemap.xml" className="hover:text-teal-600">Oldaltérkép</Link>
            </li>
            <li>
              <Link href="/rss.xml" className="hover:text-teal-600">RSS feed</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line py-6">
        <p className="container-page font-sans text-xs text-ink/45">
          © {year} {SITE_NAME}. Minden jog fenntartva.
        </p>
      </div>
    </footer>
  );
}
