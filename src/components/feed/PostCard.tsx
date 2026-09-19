"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bot, Check, Heart, LoaderCircle, Trash2, UserRound, X } from "lucide-react";
import type { AuthorType } from "@prisma/client";
import type { PostDTO } from "@/lib/feed";
import type { GuessResult } from "@/lib/guesses";
import { relativeTime, fullDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { useViewer } from "@/components/ViewerProvider";

interface PostCardProps {
  post: PostDTO;
  onChange: (post: PostDTO) => void;
  onDeleted?: (id: string) => void;
  /** Render without the surrounding link to the post page (used on the post page itself). */
  standalone?: boolean;
}

export function PostCard({ post, onChange, onDeleted, standalone }: PostCardProps) {
  const { user, setStats } = useViewer();
  const router = useRouter();
  const [guessing, setGuessing] = useState<AuthorType | null>(null);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heartPop, setHeartPop] = useState(false);

  async function guess(type: AuthorType) {
    if (guessing || post.guess) return;
    setGuessing(type);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/guess`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guess: type }),
      });
      const data = (await res.json()) as GuessResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save your guess");
      onChange({
        ...post,
        guess: {
          guessedType: data.guessedType,
          correct: data.correct,
          actualType: data.actualType,
          humanPct: data.humanPct,
          aiPct: data.aiPct,
          totalGuesses: data.totalGuesses,
        },
      });
      if (data.stats) setStats(data.stats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuessing(null);
    }
  }

  async function toggleLike() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (liking) return;
    setLiking(true);
    const optimistic = { ...post, liked: !post.liked, likeCount: post.likeCount + (post.liked ? -1 : 1) };
    onChange(optimistic);
    if (!post.liked) {
      setHeartPop(true);
      setTimeout(() => setHeartPop(false), 300);
    }
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const data = (await res.json()) as { liked: boolean; likeCount: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update like");
      onChange({ ...optimistic, liked: data.liked, likeCount: data.likeCount });
    } catch (err) {
      onChange(post);
      setError((err as Error).message);
    } finally {
      setLiking(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this post?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not delete");
      onDeleted?.(post.id);
      if (standalone) router.push("/");
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

  const reveal = post.guess;

  return (
    <article className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-bg-subtle/50 md:px-5">
      <Link href={`/u/${post.author.username}`} className="mt-0.5 shrink-0" aria-label={`${post.author.displayName}'s profile`}>
        <Avatar src={post.author.profileImage} name={post.author.displayName} size={44} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-[15px] leading-5">
          <Link href={`/u/${post.author.username}`} className="truncate font-semibold hover:underline">
            {post.author.displayName}
          </Link>
          <Link href={`/u/${post.author.username}`} className="truncate text-fg-muted">
            @{post.author.username}
          </Link>
          <span className="text-fg-faint">·</span>
          {standalone ? (
            <span className="shrink-0 text-fg-muted" title={fullDateTime(post.createdAt)}>
              {relativeTime(post.createdAt)}
            </span>
          ) : (
            <Link href={`/post/${post.id}`} className="shrink-0 text-fg-muted hover:underline" title={fullDateTime(post.createdAt)}>
              {relativeTime(post.createdAt)}
            </Link>
          )}
          {post.isOwn && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="ml-auto rounded-full p-1 text-fg-faint hover:bg-bg-subtle hover:text-danger"
              title="Delete post"
              aria-label="Delete post"
            >
              {deleting ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </button>
          )}
        </div>

        <p className="post-text mt-1 text-[15px] leading-[1.45]">{post.text}</p>

        <div className="mt-2.5 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleLike}
            disabled={liking}
            aria-pressed={post.liked}
            aria-label={post.liked ? "Unlike" : "Like"}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-sm transition-colors",
              post.liked ? "text-like" : "text-fg-muted hover:text-like",
            )}
          >
            <span className="rounded-full p-1.5 transition-colors group-hover:bg-like/10">
              <Heart size={18} className={cn(post.liked && "fill-current", heartPop && "animate-heart-pop")} />
            </span>
            <span className="tabular-nums">{post.likeCount > 0 ? post.likeCount : ""}</span>
          </button>
        </div>

        {/* ---- Guess panel ---- */}
        <div className="mt-2">
          {post.isOwn ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-bg-subtle px-3 py-1 text-xs font-medium text-fg-muted">
              <UserRound size={13} /> Your post
            </div>
          ) : reveal ? (
            <RevealPanel reveal={reveal} />
          ) : (
            <div className="flex items-center gap-2">
              <span className="mr-1 hidden text-xs font-medium text-fg-muted sm:inline">Who wrote this?</span>
              <GuessButton
                type="HUMAN"
                onClick={() => guess("HUMAN")}
                loading={guessing === "HUMAN"}
                disabled={guessing !== null}
              />
              <GuessButton type="AI" onClick={() => guess("AI")} loading={guessing === "AI"} disabled={guessing !== null} />
            </div>
          )}
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        </div>
      </div>
    </article>
  );
}

function GuessButton({
  type,
  onClick,
  loading,
  disabled,
}: {
  type: AuthorType;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const human = type === "HUMAN";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 min-w-[96px] items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
        human
          ? "border-human/40 bg-human-soft text-human hover:bg-human hover:text-white"
          : "border-ai/40 bg-ai-soft text-ai hover:bg-ai hover:text-white",
      )}
    >
      {loading ? <LoaderCircle size={15} className="animate-spin" /> : human ? <UserRound size={15} /> : <Bot size={15} />}
      {human ? "Human" : "AI"}
    </button>
  );
}

function RevealPanel({ reveal }: { reveal: NonNullable<PostDTO["guess"]> }) {
  const wasHuman = reveal.actualType === "HUMAN";
  return (
    <div
      className={cn(
        "animate-pop-in rounded-xl border px-3 py-2.5",
        reveal.correct ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
            reveal.correct ? "bg-success text-white" : "bg-danger text-white",
          )}
        >
          {reveal.correct ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
          {reveal.correct ? "Correct" : "Incorrect"}
        </span>
        <span className="text-fg">
          Written by{" "}
          <span className={cn("inline-flex items-center gap-1 font-semibold", wasHuman ? "text-human" : "text-ai")}>
            {wasHuman ? <UserRound size={14} /> : <Bot size={14} />}
            {wasHuman ? "a human" : "an AI"}
          </span>
          {!reveal.correct && <span className="text-fg-muted"> · you said {reveal.guessedType === "HUMAN" ? "human" : "AI"}</span>}
        </span>
      </div>
      {reveal.totalGuesses > 0 && (
        <div className="mt-2">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-border">
            <div className="bg-human" style={{ width: `${reveal.humanPct}%` }} />
            <div className="bg-ai" style={{ width: `${reveal.aiPct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-fg-muted tabular-nums">
            <span>
              <span className="font-semibold text-human">{reveal.humanPct}%</span> said human
            </span>
            <span>
              {reveal.totalGuesses} {reveal.totalGuesses === 1 ? "guess" : "guesses"}
            </span>
            <span>
              <span className="font-semibold text-ai">{reveal.aiPct}%</span> said AI
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
