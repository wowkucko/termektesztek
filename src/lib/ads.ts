// AdSense-konfiguráció (szerver + kliens oldalról is használható -
// direktíva nélküli modul, csak env-olvasás).
export const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || '';

export function slots(): { article: string; sidebar: string } {
  return {
    article: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE || '',
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || '',
  };
}
