'use client';

import { useEffect, useState } from 'react';

function Circle({
  href,
  label,
  bg,
  onClick,
  children,
}: {
  href?: string;
  label: string;
  bg: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const cls = `flex h-10 w-10 items-center justify-center rounded-full text-white shadow-card transition-transform hover:scale-110 active:scale-95 ${bg}`;
  const icon = (
    <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
      {children}
    </span>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={label} className={cls}>
        {icon}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={cls}>
      {icon}
    </button>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // vágólap nem elérhető (nem biztonságos kontextus) - csendben
    }
  };

  const nativeShare = () => {
    navigator.share({ title, url }).catch(() => {});
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 font-sans text-sm">
      <span className="w-full font-semibold text-ink/60">Oszd meg:</span>

      <Circle href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} label="Megosztás Facebookon" bg="bg-[#1877F2]">
        <span className="font-display text-lg font-bold leading-none">f</span>
      </Circle>

      <Circle href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`} label="Megosztás X-en" bg="bg-black">
        <span className="text-base font-bold leading-none">X</span>
      </Circle>

      <Circle href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`} label="Megosztás WhatsAppon" bg="bg-[#25D366]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </Circle>

      <Circle href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`} label="Megosztás Telegramon" bg="bg-[#229ED9]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </Circle>

      <Circle href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`} label="Küldés e-mailben" bg="bg-teal-600">
        <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </Circle>

      <Circle label={copied ? 'Link kimásolva!' : 'Link másolása'} bg={copied ? 'bg-pro' : 'bg-ink/70'} onClick={copy}>
        {copied ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </Circle>

      {canNativeShare && (
        <Circle label="Rendszer megosztó" bg="bg-signal" onClick={nativeShare}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </Circle>
      )}
    </div>
  );
}
