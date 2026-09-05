import type { Metadata } from 'next';
import { getTopRatedOverall } from '@/lib/data';
import { SITE_NAME, absoluteUrl } from '@/lib/seo';
import SeasonHub from '@/components/site/SeasonHub';

export const revalidate = 86400; // naponta frissül (szezonális oldal)

export const metadata: Metadata = {
  title: `Black Friday ${new Date().getFullYear()} – mit érdemes venni a tesztek alapján?`,
  description:
    'Black Friday vásárlási útmutató: a legjobbra értékelt termékeink rangsora magyar tesztekkel. Nézd meg, melyik akció éri meg ténylegesen.',
  alternates: { canonical: absoluteUrl('/black-friday') },
  openGraph: { title: 'Black Friday útmutató', url: absoluteUrl('/black-friday') },
};

export default async function BlackFridayPage() {
  const top = await getTopRatedOverall(10);
  const year = new Date().getFullYear();
  return (
    <SeasonHub
      kicker={`🛍️ Black Friday ${year}`}
      title={`Black Friday ${year}: mit érdemes venni a tesztjeink alapján?`}
      intro={`Black Friday alatt könnyű bedőlni a nagy százalékoknak — ez a lista segít, hogy csak olyat vegyél akciósan, ami tényleg jó. A ${SITE_NAME} legjobbra értékelt termékei egy helyen, részletes magyar nyelvű tesztekkel: hasonlítsd össze a pontszámokat, olvasd el az előnyöket és hátrányokat, és csak utána kattints a vásárlás gombra.`}
      posts={top}
      crumbs={[{ name: 'Kezdőlap', href: '/' }, { name: `Black Friday ${year}` }]}
    />
  );
}
