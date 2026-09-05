import Link from 'next/link';
import { getAllCategories } from '@/lib/data';
import SearchForm from './SearchForm';
import MobileMenu from './MobileMenu';

export default async function Header() {
  const categories = await getAllCategories();
  const topCategories = categories.slice(0, 5);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="container-page flex h-16 items-center gap-4 lg:gap-6">
        {/* Logó */}
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-signal" aria-hidden="true" />
          <span className="truncate font-display text-base font-bold tracking-tight text-ink sm:text-lg">
            Terméktesztek és vélemények
          </span>
        </Link>

        {/* Desktop (lg+): kompakt kereső a logó mellett - fix szélesség,
            sosem nyomja rá a navra. lg: keskeny, xl: tágasabb. */}
        <div className="hidden shrink-0 lg:block">
          <div className="w-36 xl:w-56">
            <SearchForm />
          </div>
        </div>

        <div className="hidden flex-1 lg:block" aria-hidden="true" />

        {/* Desktop (lg+): kategória navigáció - lg-xl: 3, 2xl: mind az 5
            (a hosszú magyar kategórianevek így férnek el minden sávban) */}
        <nav aria-label="Fő navigáció" className="hidden shrink-0 items-center gap-4 font-sans text-sm lg:flex xl:gap-5">
          {topCategories.slice(0, 3).map((cat) => (
            <Link
              key={cat.id}
              href={`/kategoria/${cat.slug}`}
              className="whitespace-nowrap text-ink/70 transition-colors hover:text-teal-600 2xl:hidden"
            >
              {cat.name}
            </Link>
          ))}
          {topCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/kategoria/${cat.slug}`}
              className="hidden whitespace-nowrap text-ink/70 transition-colors hover:text-teal-600 2xl:inline-block"
            >
              {cat.name}
            </Link>
          ))}
        </nav>

        {/* Mobil + tablet (lg alatt): hamburger (kereső + kategóriák a menüben) */}
        <div className="ml-auto flex shrink-0 items-center lg:hidden">
          <MobileMenu categories={topCategories.map((c) => ({ name: c.name, slug: c.slug }))} />
        </div>
      </div>
    </header>
  );
}
