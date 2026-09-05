'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/utils';
import LogoutButton from './LogoutButton';

const links = [
  { href: '/admin', label: 'Áttekintés', exact: true },
  { href: '/admin/posts', label: 'Bejegyzések' },
  { href: '/admin/sync', label: 'Auto szinkron' },
  { href: '/admin/push', label: 'Push to live' },
  { href: '/admin/linkcheck', label: 'Link-ellenőrzés' },
  { href: '/admin/keresesek', label: 'Keresések' },
  { href: '/admin/hozzaszolasok', label: 'Hozzászólások' },
  { href: '/admin/categories', label: 'Kategóriák' },
  { href: '/admin/tags', label: 'Címkék' },
];

export default function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <>
      {/* Desktop: függőleges sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col justify-between bg-ink px-4 py-6 lg:flex">
        <div>
          <div className="mb-8 flex items-center gap-2 px-2">
            <span className="h-2.5 w-2.5 rounded-full bg-signal" aria-hidden="true" />
            <span className="font-display text-base font-bold text-white">Admin</span>
          </div>

          <nav className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  'block rounded-tight px-3 py-2 font-sans text-sm font-medium transition-colors',
                  isActive(link.href, link.exact) ? 'bg-signal text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            target="_blank"
            className="block rounded-tight px-3 py-2 font-sans text-sm text-white/50 hover:text-white"
          >
            Nyilvános oldal megtekintése ↗
          </Link>
          <div className="border-t border-white/10 pt-3">
            <p className="truncate px-3 font-sans text-xs text-white/40">{userName}</p>
            <div className="mt-2 px-1">
              <LogoutButton />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobil: felső sáv görgethető navigációval */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-signal" aria-hidden="true" />
            <span className="truncate font-display text-base font-bold text-white">Admin</span>
            <span className="hidden truncate font-sans text-xs text-white/40 sm:block">{userName}</span>
          </div>
          <LogoutButton compact />
        </div>
        <nav aria-label="Admin navigáció" className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cx(
                'whitespace-nowrap rounded-tight px-3 py-1.5 font-sans text-sm font-medium transition-colors',
                isActive(link.href, link.exact) ? 'bg-signal text-white' : 'text-white/60 hover:text-white'
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/" target="_blank" className="whitespace-nowrap rounded-tight px-3 py-1.5 font-sans text-sm text-white/50 hover:text-white">
            Oldal ↗
          </Link>
        </nav>
      </header>
    </>
  );
}