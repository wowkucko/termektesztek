import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || '';

// Oldalszintű scriptek: GA4 (Consent Mode-dal) + AdSense Auto Ads.
// Az AdSense-szkript csak publisher ID esetén töltődik; a kézi egységek
// (AdSlot) külön, a cikkoldalon és az oldalsávban jelennek meg.
export default function SiteScripts() {
  return (
    <>
      {/* Süti-banner festés ELŐTTI elrejtése a korábban döntött látogatóknál:
          az SSR-renderelt banner (CookieBanner) a hidrációig a DOM-ban marad,
          ez a head-beli inline script dönt festéskor, hogy látszik-e — így a
          már elutasított/elfogadott látogatóknál nem villan fel, és a banner
          nem válik LCP-elemmé. Lásd: globals.css .cookie-decided szabály. */}
      <Script id="cookie-hide" strategy="beforeInteractive" dangerouslySetInnerHTML={{
        __html: `(function(){try{if(localStorage.getItem('cookie-consent')){document.documentElement.classList.add('cookie-decided');}}catch(e){}})();`,
      }} />

      {GA_ID && (
        <>
          <Script
            id="ga-consent-default"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});`,
            }}
          />
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script
            id="ga-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`,
            }}
          />
        </>
      )}
      {ADSENSE_ID && (
        <Script
          id="adsense-auto"
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
          crossOrigin="anonymous"
        />
      )}
    </>
  );
}
