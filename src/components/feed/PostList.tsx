"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { FeedPage, PostDTO } from "@/lib/feed";
import { PostCard } from "@/components/feed/PostCard";

interface PostListProps {
  initial: FeedPage;
  /** Endpoint that returns a FeedPage; `cursor` is appended as a query param. */
  endpoint: string;
  emptyMessage?: string;
}

/** Simple paginated list of posts (profiles, etc.). The home feed has its own component. */
export function PostList({ initial, endpoint, emptyMessage = "No posts yet." }: PostListProps) {
  const [posts, setPosts] = useState<PostDTO[]>(initial.posts);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("cursor", nextCursor);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load posts");
      const page = (await res.json()) as FeedPage;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [endpoint, nextCursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const updatePost = useCallback((next: PostDTO) => {
    setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }, []);
  const removePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  if (posts.length === 0) {
    return <div className="px-4 py-16 text-center text-sm text-fg-muted">{emptyMessage}</div>;
  }

  return (
    <div>
      <ul className="divide-y divide-border">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} onChange={updatePost} onDeleted={removePost} />
          </li>
        ))}
      </ul>
      <div ref={sentinelRef} className="flex items-center justify-center py-8 text-fg-muted">
        {loading ? (
          <LoaderCircle size={20} className="animate-spin" />
        ) : error ? (
          <button type="button" onClick={loadMore} className="text-sm text-danger hover:underline">
            {error} — tap to retry
          </button>
        ) : nextCursor ? (
          <button type="button" onClick={loadMore} className="text-sm font-medium text-accent hover:underline">
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
