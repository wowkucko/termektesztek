'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import SearchForm from './SearchForm';

type Category = { name: string; slug: string };

// A mobil menüpanel — a MobileMenu csak akkor tölti be (dinamikus import),
// amikor a felhasználó először megnyitja a menüt. Csak nyitott állapotban
// van a DOM-ban, így a bezáráskor a listenerek és a scroll-zár is takarítódnak.
export default function MobileMenuPanel({
  categories,
  onClose,
}: {
  categories: Category[];
  onClose: () => void;
}) {
  const pathname = usePathname();

  // Body scroll-zárás nyitott menüben + Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Útváltásnál bezárul (pathname változás = navigáció megtörtént).
  // Ref-fel védve: a mount-kor LEFUTÓ effect ne zárja be azonnal a menüt.
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  return (
    <>
      <div
        id="mobile-menu-panel"
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigáció"
        className="animate-[menuIn_.18s_ease-out] fixed inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-b-2xl border-b border-line bg-white px-5 pb-6 pt-4 shadow-card lg:hidden"
      >
        {/* Kereső a menüben (találatok folyamatba ágyazva) */}
        <div className="pb-4">
          <SearchForm inlineResults />
        </div>

        {/* Kategóriák */}
        <nav aria-label="Mobil navigáció" className="flex flex-col">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/kategoria/${cat.slug}`}
              className="border-b border-line/60 py-3 font-sans text-base font-medium text-ink transition-colors last:border-0 hover:text-teal-600"
            >
              {cat.name}
            </Link>
          ))}
          <Link
            href="/kereses"
            className="border-b border-line/60 py-3 font-sans text-base font-medium text-ink transition-colors last:border-0 hover:text-teal-600"
          >
            Összes teszt
          </Link>
        </nav>
      </div>
    </>
  );
}
