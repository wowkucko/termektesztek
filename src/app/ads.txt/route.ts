// GET /ads.txt - AdSense hitelesítés. A publisher ID-t és az eladói
// azonosítót a .env adja (NEXT_PUBLIC_ADSENSE_ID, ADSENSE_SELLER_ID);
// az AdSense-panel (Bevételek -> ads.txt) mutatja a pontos sort.
export async function GET() {
  const pub = (process.env.NEXT_PUBLIC_ADSENSE_ID || '').trim();
  const seller = (process.env.ADSENSE_SELLER_ID || '').trim();
  const line = pub ? `google.com, ${pub}, DIRECT${seller ? `, ${seller}` : ''}` : '# AdSense nincs beallitva (NEXT_PUBLIC_ADSENSE_ID hianyzik)';
  return new Response(line + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
