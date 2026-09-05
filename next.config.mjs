/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Szerver-indításkor lefutó hook (link-ellenőrző ütemező)
    instrumentationHook: true,
  },
  images: {
    // Local uploads are served from /public/uploads, no remote domains needed by default.
    // Add remotePatterns here if you ever host images externally (e.g. a CDN).
    remotePatterns: [],
    // Extra kisebb méret: a borító- és kártyaképek így nem 640px-es, hanem
    // 480px-es variánst kérnek mobilon (kisebb LCP-kép a kritikus úton).
    imageSizes: [480],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
