"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { PostDTO } from "@/lib/feed";
import { POST_MAX_LENGTH } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui";
import { useViewer } from "@/components/ViewerProvider";

interface ComposerProps {
  onPosted: (post: PostDTO) => void;
  autoFocus?: boolean;
}

export function Composer({ onPosted, autoFocus }: ComposerProps) {
  const { user, aiEnabled } = useViewer();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<"human" | "ai" | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const [hint, setHint] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  // Grow with content.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text]);

  if (!user) return null;

  const remaining = POST_MAX_LENGTH - text.length;
  const canPost = text.trim().length > 0 && remaining >= 0 && !submitting;

  function flashPosted(kind: "human" | "ai") {
    setPosted(kind);
    setTimeout(() => setPosted(null), 3500);
  }

  async function submit() {
    if (!canPost) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as PostDTO & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not post");
      onPosted(data);
      setText("");
      flashPosted("human");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAi() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hint: hint.trim() || undefined }),
      });
      const data = (await res.json()) as PostDTO & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not generate a post");
      onPosted(data);
      setHint("");
      setAiMode(false);
      flashPosted("ai");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="composer" className="flex gap-3 border-b border-border px-4 py-4 md:px-5">
      <Avatar src={user.profileImage} name={user.displayName} size={44} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {aiMode ? (
          <div className="rounded-2xl border border-ai/30 bg-ai-soft/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-ai">
                  <Sparkles size={15} /> Let an AI post as you
                </div>
                <p className="mt-0.5 text-xs text-fg-muted">
                  It writes one post in your voice and publishes it under your name. Secretly it counts as AI, so
                  guessers can&apos;t assume your account is always human.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiMode(false)}
                className="rounded-full p-1 text-fg-muted hover:bg-bg hover:text-fg"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value.slice(0, 140))}
              placeholder="Optional: what should it be about? (e.g. my commute)"
              className="mt-3 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm placeholder:text-fg-faint focus:border-ai focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setAiMode(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitAi} loading={submitting} className="bg-ai text-white hover:bg-ai/90">
                <Sparkles size={14} /> Write &amp; post
              </Button>
            </div>
          </div>
        ) : (
          <>
            <textarea
              id="composer-input"
              ref={ref}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
              placeholder="What's happening?"
              rows={2}
              maxLength={POST_MAX_LENGTH + 50}
              className="w-full resize-none bg-transparent py-1.5 text-[19px] leading-snug placeholder:text-fg-faint focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0 text-xs text-fg-muted">
                {posted === "human" ? (
                  <span className="text-success">Posted. It&apos;s in the feed now.</span>
                ) : posted === "ai" ? (
                  <span className="text-ai">Posted under your name, written by an AI.</span>
                ) : error ? (
                  <span className="text-danger">{error}</span>
                ) : aiEnabled ? (
                  <button
                    type="button"
                    onClick={() => setAiMode(true)}
                    className="inline-flex items-center gap-1 rounded-full font-medium text-ai hover:underline"
                  >
                    <Sparkles size={13} /> Or let an AI write one for you
                  </button>
                ) : (
                  <span>Your post goes into the same feed as everyone else&apos;s. Nobody is told it&apos;s human.</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={cn("text-xs tabular-nums", remaining < 0 ? "text-danger" : remaining < 40 ? "text-fg" : "text-fg-faint")}>
                  {remaining}
                </span>
                <Button size="sm" onClick={submit} disabled={!canPost} loading={submitting} className="px-5">
                  Post
                </Button>
              </div>
            </div>
          </>
        )}
        {aiMode && error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
