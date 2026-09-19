"use client";

import { useEffect, useRef, useState } from "react";
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
  const { user } = useViewer();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
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
      setPosted(true);
      setTimeout(() => setPosted(false), 2500);
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
          <div className="text-xs text-fg-muted">
            {posted ? (
              <span className="text-success">Posted. It&apos;s in the feed now.</span>
            ) : error ? (
              <span className="text-danger">{error}</span>
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
      </div>
    </div>
  );
}
