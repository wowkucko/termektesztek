import type { Metadata } from 'next';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Kapcsolat',
  description: `Vedd fel a kapcsolatot a ${SITE_NAME} szerkesztőségével: kérdések, észrevételek, javítási javaslatok.`,
  alternates: { canonical: absoluteUrl('/kapcsolat') },
  openGraph: { title: 'Kapcsolat', url: absoluteUrl('/kapcsolat') },
};

function contactEmail(): string {
  try {
    return `info@${new URL(SITE_URL).hostname.replace(/^www\./, '')}`;
  } catch {
    return 'info@peldablog.hu';
  }
}

export default function ContactPage() {
  const crumbs = [{ name: 'Kezdőlap', href: '/' }, { name: 'Kapcsolat' }];
  const email = contactEmail();
  return (
    <div className="container-page py-10 pb-20">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold text-ink sm:text-4xl">Kapcsolat</h1>
      <div className="post-content mt-6 max-w-3xl">
        <p>
          Kérdésed van egy teszttel kapcsolatban, hibát találtál egy cikkben, vagy új termék
          tesztjét szeretnéd kérni? Írj nekünk e-mailt, igyekszünk minden megkeresésre
          válaszolni:
        </p>
        <p>
          <a href={`mailto:${email}`} className="font-semibold">
            {email}
          </a>
        </p>
        <p>
          Tesztre javasolt termék esetén írd meg a termék pontos nevét és márkáját — a
          leggyakrabban kért termékeket előre vesszük a tesztelési listánkon.
        </p>
      </div>
    </div>
  );
}
