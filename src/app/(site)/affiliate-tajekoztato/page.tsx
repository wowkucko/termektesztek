import type { Metadata } from 'next';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import { SITE_NAME, absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Affiliate tájékoztató',
  description: `Átlátható tájékoztatás a ${SITE_NAME} oldalain található partnerlinkekről (affiliate linkekről) és azok hatásáról az értékeléseinkre.`,
  alternates: { canonical: absoluteUrl('/affiliate-tajekoztato') },
  openGraph: { title: 'Affiliate tájékoztató', url: absoluteUrl('/affiliate-tajekoztato') },
};

export default function AffiliatePage() {
  const crumbs = [{ name: 'Kezdőlap', href: '/' }, { name: 'Affiliate tájékoztató' }];
  return (
    <div className="container-page py-10 pb-20">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold text-ink sm:text-4xl">
        Affiliate tájékoztató
      </h1>
      <div className="post-content mt-6 max-w-3xl">
        <p>
          A <strong>{SITE_NAME}</strong> cikkeiben található „Termék megvásárlása" gombok egy
          része úgynevezett <strong>partnerlink (affiliate link)</strong>: ha ezekre kattintva
          vásárolsz az adott webshopban, az oldal jutalékot kaphat a vásárlás után. Neked ez nem
          jelent plusz költséget — a termék ára ugyanannyi, mintha közvetlenül mentél volna a
          webshopba.
        </p>
        <h2>Befolyásolja ez az értékeléseinket?</h2>
        <p>
          Nem. A pontszámainkat és a verdikteket kizárólag a termékadatok és a vásárlói
          vélemények alapján alakítjuk ki, a szerkesztési elveink szerint: több komoly hátrány
          esetén egy termék nem kaphat magas pontszámot, függetlenül attól, hogy tartozik-e
          hozzá vásárlási link. A jutalék az oldal fenntartását (szerkesztés, tárhely,
          fejlesztés) segíti.
        </p>
        <h2>Hogyan jelöljük?</h2>
        <p>
          A külső vásárlási linkek <code>rel=&quot;sponsored&quot;</code> jelöléssel szerepelnek
          az oldalon, ami a keresőmotorok számára is egyértelműen jelzi a partneri kapcsolatot.
        </p>
      </div>
    </div>
  );
}
