import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';
import GoogleAnalytics from '@/components/site/GoogleAnalytics';
import CookieBanner from '@/components/site/CookieBanner';
import BackToTop from '@/components/site/BackToTop';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GoogleAnalytics />
      <Header />
      <main>{children}</main>
      <Footer />
      <CookieBanner />
      <BackToTop />
    </>
  );
}
