'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

export type TopPick = {
  category: { id: string; name: string; slug: string };
  pick: {
    slug: string;
    title: string;
    productBrand: string | null;
    productName: string | null;
    coverImage: string | null;
    coverImageAlt: string | null;
    rating: number | null;
  };
};

const STEP = 560; // kb. 2 kártya

export default function TopPickStrip({ picks }: { picks: TopPick[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  };

  useEffect(() => {
    updateArrows();
    window.addEventListener('resize', updateArrows);
    return () => window.removeEventListener('resize', updateArrows);
  }, []);

  const step = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * STEP, behavior: 'smooth' });
  };

  const arrowCls =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink shadow-card transition-all hover:border-teal-500 hover:text-teal-600 disabled:cursor-default disabled:opacity-25 disabled:hover:border-line disabled:hover:text-ink';

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={!canLeft}
        aria-label="Toplisták görgetése balra"
        className={`${arrowCls} hidden sm:flex`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div
        ref={trackRef}
        onScroll={updateArrows}
        className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-2"
      >
        {picks.map(({ category, pick }) => (
          <Link
            key={category.id}
            href={`/legjobb/${category.slug}`}
            className="group w-60 shrink-0 snap-start overflow-hidden rounded-card border border-line bg-white transition-colors hover:border-teal-500"
          >
            <div className="relative aspect-[16/10] bg-teal-50">
              {pick.coverImage && (
                <Image
                  src={pick.coverImage}
                  alt={pick.coverImageAlt || pick.title}
                  fill
                  sizes="240px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="p-4">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-signal-600">
                🏆 Legjobb {category.name.toLowerCase()}
              </p>
              <p className="mt-1 line-clamp-2 font-sans text-sm font-semibold leading-snug text-ink group-hover:text-teal-700">
                {[pick.productBrand, pick.productName].filter(Boolean).join(' — ') || pick.title}
              </p>
              {pick.rating != null && (
                <p className="mt-1 font-sans text-sm font-bold text-teal-700">
                  {pick.rating.toFixed(1)}/10
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={!canRight}
        aria-label="Toplisták görgetése jobbra"
        className={`${arrowCls} hidden sm:flex`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
