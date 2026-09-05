import type { Metadata } from 'next';
import { Archivo, Source_Serif_4, Inter } from 'next/font/google';
import './globals.css';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl, websiteJsonLd, organizationJsonLd } from '@/lib/seo';

// Variable fontok, NEM preloadolva (`display: swap`): a betűtípusok nem
// kellenek az első festéshez (előbb a fallback szöveg festődik, utána csere),
// így a preload csak a kritikus utat terhelné – ezért nincs preload, és a
// borítókép (LCP) kapja az elsőbbséget a hálózaton.
const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: 'variable',
  variable: '--font-display',
  display: 'swap',
  preload: false,
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin', 'latin-ext'],
  weight: 'variable',
  variable: '--font-body',
  display: 'swap',
  preload: false,
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: 'variable',
  variable: '--font-sans',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'hu_HU',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: absoluteUrl('/og-default.png'), width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl('/og-default.png')],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    types: { 'application/rss+xml': '/rss.xml' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={`${archivo.variable} ${sourceSerif.variable} ${inter.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        {children}
      </body>
    </html>
  );
}
