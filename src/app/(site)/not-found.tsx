import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center text-center py-20">
      <p className="font-display text-6xl font-bold text-signal">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">Ezt az oldalt nem találjuk</h1>
      <p className="mt-3 max-w-md font-body text-ink/60">
        Lehet, hogy a cikket, amit keresel, időközben átneveztük vagy törölte a szerkesztőség.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Vissza a kezdőlapra
      </Link>
    </div>
  );
}
