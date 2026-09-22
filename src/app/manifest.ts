import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#F2F4F1',
    theme_color: '#0E6E63',
    lang: 'hu',
    icons: [
      { src: absoluteUrl('/icon.png'), sizes: '96x96', type: 'image/png' },
      { src: absoluteUrl('/apple-icon.png'), sizes: '360x360', type: 'image/png' },
    ],
  };
}
