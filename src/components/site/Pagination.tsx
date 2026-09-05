import Link from 'next/link';

export default function Pagination({
  page,
  total,
  pageSize,
  basePath,
  queryParam,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  queryParam?: string;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    if (queryParam) params.set('q', queryParam);
    params.set('page', String(p));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <nav aria-label="Lapozás" className="mt-12 flex items-center justify-center gap-2 font-sans text-sm">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={`rounded-tight border border-ink/15 px-3 py-2 ${page === 1 ? 'pointer-events-none opacity-40' : 'hover:border-teal-500 hover:text-teal-600'}`}
      >
        Előző
      </Link>
      <span className="px-3 py-2 text-ink/60">
        {page}. / {totalPages}
      </span>
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={`rounded-tight border border-ink/15 px-3 py-2 ${page === totalPages ? 'pointer-events-none opacity-40' : 'hover:border-teal-500 hover:text-teal-600'}`}
      >
        Következő
      </Link>
    </nav>
  );
}
