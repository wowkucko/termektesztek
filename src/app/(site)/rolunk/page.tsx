import type { Metadata } from 'next';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import { SITE_NAME, absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Rólunk',
  description: `Ismerd meg a ${SITE_NAME} csapatát: hogyan készülnek a magyar nyelvű terméktesztjeink, milyen módszerrel értékelünk.`,
  alternates: { canonical: absoluteUrl('/rolunk') },
  openGraph: { title: 'Rólunk', url: absoluteUrl('/rolunk') },
};

export default function AboutPage() {
  const crumbs = [{ name: 'Kezdőlap', href: '/' }, { name: 'Rólunk' }];
  return (
    <div className="container-page py-10 pb-20">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold text-ink sm:text-4xl">Rólunk</h1>
      <div className="post-content mt-6 max-w-3xl">
        <p>
          A <strong>{SITE_NAME}</strong> egy magyar nyelvű termékteszt-oldal: mindenféle
          kategóriában mutatunk be termékeket az interneten elérhető nyilvános termékadatok és
          valódi vásárlói vélemények alapján.
        </p>
        <h2>Hogyan készülnek a tesztjeink?</h2>
        <p>
          Minden cikkhez összegyűjtjük a termékétlap leírását, főbb paramétereit és a vásárlók
          értékeléseit, majd ezekből szerkesztőségünk átfogó, olvasmányos tesztet állít össze:
          bemutatjuk a tudást, összegezzük a vásárlói tapasztalatokat, felsoroljuk az előnyöket
          és hátrányokat, végül 0–10-es skálán pontozunk és rövid verdiktet mondunk.
        </p>
        <h2>Függetlenség</h2>
        <p>
          A pontszámainkat nem befolyásolja, hogy egy termékhez tartozik-e vásárlási link.
          Ha egy termék gyenge, azt leírjuk — a sok hátránnyal rendelkező termékek nem kaphatnak
          magas pontszámot, ezt a szerkesztési elveink garantálják. A vásárlási linkek egy része
          partnerlink: ha ezeken keresztül vásárolsz, jutalékot kaphatunk, ami az oldal
          fenntartását segíti. Részletek: <a href="/affiliate-tajekoztato">affiliate tájékoztató</a>.
        </p>
        <h2>Kapcsolat</h2>
        <p>
          Kérdésed, észrevételed van? Írj nekünk a <a href="/kapcsolat">kapcsolat</a> oldalon
          található elérhetőségen.
        </p>
      </div>
    </div>
  );
}
