import type { Metadata } from 'next';
import { getTopRatedOverall } from '@/lib/data';
import { SITE_NAME, absoluteUrl } from '@/lib/seo';
import SeasonHub from '@/components/site/SeasonHub';

export const revalidate = 86400; // naponta frissül (szezonális oldal)

export const metadata: Metadata = {
  title: `Karácsonyi ajándék ötletek ${new Date().getFullYear()} – a legjobbra értékelt termékek`,
  description:
    'Karácsonyi ajándék ötletek a legjobbra értékelt termékeinkből: rangsorolt ajánlatok magyar nyelvű tesztekkel, pontszámokkal és vásárlási linkekkel.',
  alternates: { canonical: absoluteUrl('/karacsony') },
  openGraph: { title: 'Karácsonyi ajándék ötletek', url: absoluteUrl('/karacsony') },
};

export default async function ChristmasPage() {
  const top = await getTopRatedOverall(10);
  const year = new Date().getFullYear();
  return (
    <SeasonHub
      kicker={`🎄 Karácsony ${year}`}
      title={`Karácsonyi ajándék ötletek ${year}: a legjobbra értékelt termékeink`}
      intro={`Nincs ötleted, mit vegyél karácsonyra? Összegyűjtöttük az oldalunkon legjobbra értékelt termékeket minden kategóriából — mindegyikhez részletes magyar nyelvű teszt tartozik előnyökkel, hátrányokkal és vásárlói véleményekkel, így biztosan jó helyre kerül a pénzed. A lista a ${SITE_NAME} tesztpontszámai alapján rangsorol.`}
      posts={top}
      crumbs={[{ name: 'Kezdőlap', href: '/' }, { name: `Karácsonyi ajándék ötletek ${year}` }]}
    />
  );
}
