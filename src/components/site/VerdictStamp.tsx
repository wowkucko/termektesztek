import { cx } from '@/lib/utils';

function ratingWord(rating: number): string {
  if (rating >= 9) return 'Kiváló';
  if (rating >= 7.5) return 'Nagyon jó';
  if (rating >= 6) return 'Jó';
  if (rating >= 4) return 'Közepes';
  return 'Gyenge';
}

/**
 * Reszponzív rating badge: nincs abszolút pozicionálás, nem csúszik el.
 * - sm: kompakta chip (kártyákhoz, listákhoz) - szám + "/10"
 * - lg: nagyobb chip, szöveges értékeléssel (kiemelt cikkhez, blogcikk fejléchez)
 */
export function RatingBadge({
  rating,
  size = 'sm',
  className,
}: {
  rating: number;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const isLg = size === 'lg';
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-chip font-sans font-bold leading-none text-white',
        isLg ? 'bg-signal px-4 py-2.5 text-xl' : 'bg-signal px-2.5 py-1.5 text-sm',
        className
      )}
      aria-label={`Értékelés: ${rating.toFixed(1)} a 10-ből (${ratingWord(rating)})`}
    >
      <span className="font-display">{rating.toFixed(1)}</span>
      <span className={cx('font-sans font-semibold', isLg ? 'text-xs' : 'text-[9px]')}>/10</span>
      {isLg && (
        <span className="ml-1 border-l border-white/30 pl-2 text-xs font-semibold uppercase tracking-wide">
          {ratingWord(rating)}
        </span>
      )}
    </span>
  );
}

/**
 * Régi bélyegző-szerű stamp - csak a blogcikk fejlécében marad, ott jól működik
 * (nagy, dekoratív elem fix méretű konténerben).
 */
export default function VerdictStamp({
  rating,
  size = 'sm',
  animated = false,
}: {
  rating: number;
  size?: 'sm' | 'lg';
  animated?: boolean;
}) {
  const isLg = size === 'lg';

  return (
    <div
      className={cx(
        'inline-flex -rotate-6 flex-col items-center justify-center rounded-full border-2 border-dashed border-white bg-signal text-white shadow-stamp',
        isLg ? 'h-32 w-32 gap-0.5' : 'h-16 w-16 gap-0',
        animated && 'animate-stampIn'
      )}
    >
      <span className={cx('font-display font-bold leading-none', isLg ? 'text-3xl' : 'text-lg')}>
        {rating.toFixed(1)}
      </span>
      <span className={cx('font-sans font-medium uppercase tracking-wide leading-none', isLg ? 'text-[10px] mt-1' : 'text-[7px]')}>
        /10
      </span>
      {isLg && (
        <span className="mt-1 font-sans text-[10px] font-semibold leading-none">
          {ratingWord(rating)}
        </span>
      )}
    </div>
  );
}
