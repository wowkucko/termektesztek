import { SITE_NAME } from '@/lib/seo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-4">
      <div className="mb-8 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-signal" aria-hidden="true" />
        <span className="font-display text-lg font-bold text-white">{SITE_NAME}</span>
        <span className="ml-1 rounded-chip bg-white/10 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-white/60">
          Admin
        </span>
      </div>
      {children}
    </div>
  );
}
