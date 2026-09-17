/**
 * Kis "18+" jelzés a listakártyákon és a keresőtalálatokon: a korhatár-kapu
 * alá eső cikkeket már a listában megjelöli, hogy a látogató tudja, mire
 * kattint (és hogy a kapu nem véletlenül jelenik meg).
 */
export default function AgeBadge({ className }: { className?: string }) {
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center rounded-chip bg-signal-600 px-2 py-1 font-sans text-[10px] font-bold uppercase leading-none tracking-wide text-white',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      title="Felnőtt tartalom – csak 18 éven felülieknek"
      aria-label="18 éven felülieknek"
    >
      18+
    </span>
  );
}
