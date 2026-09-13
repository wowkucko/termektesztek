import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';
import SiteScripts from '@/components/site/SiteScripts';
import CookieBanner from '@/components/site/CookieBanner';
import BackToTop from '@/components/site/BackToTop';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteScripts />
      <Header />
      <main>{children}</main>
      <Footer />
      <CookieBanner />
      <BackToTop />
    </>
  );
}
