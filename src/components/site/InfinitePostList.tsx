'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PostCardClient, { type ClientPost } from './PostCardClient';

export type ListQuery = {
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
};

// Listázó oldalak (kategória, címke, keresés) közös burkolója:
// - mobilon (<768px): infinite scroll, automatikus töltéssel;
// - asztalin/tableten: a szerverről kapott lapozó (pagination prop).
export default function InfinitePostList({
  initial,
  total,
  pageSize,
  query,
  pagination,
}: {
  initial: ClientPost[];
  total: number;
  pageSize: number;
  query: ListQuery;
  pagination: React.ReactNode;
}) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        pageSize: String(pageSize),
      });
      if (query.categorySlug) params.set('categorySlug', query.categorySlug);
      if (query.tagSlug) params.set('tagSlug', query.tagSlug);
      if (query.search) params.set('search', query.search);
      const res = await fetch(`/api/posts?${params.toString()}`);
      const j = await res.json();
      if (Array.isArray(j.posts) && j.posts.length > 0) {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...j.posts.filter((p: ClientPost) => !seen.has(p.id))];
        });
        setPage((p) => p + 1);
      }
    } catch {
      // hálózati hiba: a következő görgetésre újra próbáljuk
    } finally {
      setLoading(false);
    }
  }, [loading, page, pageSize, query.categorySlug, query.tagSlug, query.search]);

  useEffect(() => {
    if (!isMobile || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: '600px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isMobile, hasMore, loadMore]);

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((post) => (
          <PostCardClient key={post.id} post={post} />
        ))}
      </div>

      {isMobile ? (
        <div ref={sentinelRef} aria-hidden="true" className="flex min-h-[4rem] items-center justify-center py-6">
          {loading ? (
            <span className="flex items-center gap-2 font-sans text-sm text-ink/50">
              <span className="block h-5 w-5 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-500" aria-hidden="true" />
              További tesztek betöltése…
            </span>
          ) : hasMore ? (
            <span className="font-sans text-xs text-ink/35">Görgess a folytatásért ↓</span>
          ) : (
            items.length > 0 && (
              <span className="font-sans text-xs text-ink/35">— Vége a listának —</span>
            )
          )}
        </div>
      ) : (
        pagination
      )}
    </div>
  );
}
