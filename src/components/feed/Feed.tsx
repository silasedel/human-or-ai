"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Shuffle } from "lucide-react";
import type { FeedMode, FeedPage, PostDTO } from "@/lib/feed";
import { cn } from "@/lib/utils";
import { PostCard } from "@/components/feed/PostCard";
import { Composer } from "@/components/feed/Composer";
import { useViewer } from "@/components/ViewerProvider";

interface FeedProps {
  initial: FeedPage;
  seed: string;
  feedTime: number;
  initialMode: FeedMode;
  autoFocusComposer?: boolean;
}

interface ModeState {
  posts: PostDTO[];
  nextCursor: string | null;
  loaded: boolean;
}

export function Feed({ initial, seed, feedTime, initialMode, autoFocusComposer }: FeedProps) {
  const { user } = useViewer();
  const router = useRouter();
  const [mode, setMode] = useState<FeedMode>(initialMode);
  const [state, setState] = useState<Record<FeedMode, ModeState>>({
    foryou: initialMode === "foryou" ? { ...initial, loaded: true } : { posts: [], nextCursor: null, loaded: false },
    latest: initialMode === "latest" ? { ...initial, loaded: true } : { posts: [], nextCursor: null, loaded: false },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const current = state[mode];

  const fetchPage = useCallback(
    async (targetMode: FeedMode, cursor: string | null, replace: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ mode: targetMode, seed, feedTime: String(feedTime), limit: "20" });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/feed?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load the feed");
        const page = (await res.json()) as FeedPage;
        setState((prev) => {
          const existing = prev[targetMode];
          const seen = new Set(replace ? [] : existing.posts.map((p) => p.id));
          const fresh = page.posts.filter((p) => !seen.has(p.id));
          return {
            ...prev,
            [targetMode]: {
              posts: replace ? page.posts : [...existing.posts, ...fresh],
              nextCursor: page.nextCursor,
              loaded: true,
            },
          };
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [seed, feedTime],
  );

  // Infinite scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && current.nextCursor && !loadingRef.current) {
          void fetchPage(mode, current.nextCursor, false);
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode, current.nextCursor, fetchPage]);

  /** Apply a changed post to every tab that contains it. */
  const updatePost = useCallback((next: PostDTO) => {
    setState((prev) => {
      const patch = (s: ModeState): ModeState => ({
        ...s,
        posts: s.posts.map((p) => (p.id === next.id ? next : p)),
      });
      return { foryou: patch(prev.foryou), latest: patch(prev.latest) };
    });
  }, []);

  const removePost = useCallback((id: string) => {
    setState((prev) => {
      const patch = (s: ModeState): ModeState => ({ ...s, posts: s.posts.filter((p) => p.id !== id) });
      return { foryou: patch(prev.foryou), latest: patch(prev.latest) };
    });
  }, []);

  const handlePosted = useCallback((post: PostDTO) => {
    setState((prev) => {
      const prepend = (s: ModeState): ModeState => (s.loaded ? { ...s, posts: [post, ...s.posts] } : s);
      return { foryou: prepend(prev.foryou), latest: prepend(prev.latest) };
    });
  }, []);

  function reshuffle() {
    router.refresh();
  }

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur md:top-0">
        <div className="flex items-center justify-between px-4 pt-3 md:px-5">
          <h1 className="text-lg font-semibold">Home</h1>
          {mode === "foryou" && (
            <button
              type="button"
              onClick={reshuffle}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-bg-subtle hover:text-fg"
              title="Get a fresh shuffle"
            >
              <Shuffle size={14} /> Shuffle
            </button>
          )}
        </div>
        <div className="mt-1 flex">
          {(
            [
              ["foryou", "For you"],
              ["latest", "Latest"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                if (!state[value].loaded) void fetchPage(value, null, true);
              }}
              className={cn(
                "relative flex-1 py-3 text-sm font-medium transition-colors hover:bg-bg-subtle",
                mode === value ? "text-fg" : "text-fg-muted",
              )}
            >
              {label}
              {mode === value && <span className="absolute inset-x-0 bottom-0 mx-auto h-[3px] w-14 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>

      {user ? (
        <Composer onPosted={handlePosted} autoFocus={autoFocusComposer} />
      ) : (
        <div className="border-b border-border bg-bg-subtle/60 px-4 py-4 md:px-5">
          <p className="text-[15px] font-semibold">Humans and AI both post here.</p>
          <p className="mt-0.5 text-sm text-fg-muted">
            Guess who wrote each post. Guessing works right away;{" "}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              create an account
            </Link>{" "}
            to keep a score, like posts and write your own.
          </p>
        </div>
      )}

      {current.posts.length === 0 && current.loaded && !loading ? (
        <div className="px-4 py-16 text-center text-sm text-fg-muted">
          Nothing here yet. {user ? "Be the first to post." : "Come back soon."}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {current.posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} onChange={updatePost} onDeleted={removePost} />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} className="flex items-center justify-center py-8 text-fg-muted">
        {loading ? (
          <LoaderCircle size={20} className="animate-spin" />
        ) : error ? (
          <button
            type="button"
            onClick={() => fetchPage(mode, current.nextCursor, !current.loaded)}
            className="text-sm text-danger hover:underline"
          >
            {error} — tap to retry
          </button>
        ) : current.nextCursor ? (
          <button
            type="button"
            onClick={() => fetchPage(mode, current.nextCursor, false)}
            className="text-sm font-medium text-accent hover:underline"
          >
            Load more
          </button>
        ) : current.posts.length > 0 ? (
          <span className="text-xs">You&apos;ve reached the end. {mode === "foryou" ? "Shuffle for a new order." : ""}</span>
        ) : null}
      </div>
    </div>
  );
}
