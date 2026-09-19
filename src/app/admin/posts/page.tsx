import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { TypeBadge } from "@/components/admin/TypeBadge";
import { fullDateTime } from "@/lib/time";

const PAGE_SIZE = 40;

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string; scheduled?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type: "HUMAN" | "AI" | undefined = sp.type === "HUMAN" || sp.type === "AI" ? sp.type : undefined;
  const scheduled = sp.scheduled === "1";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.PostWhereInput = {
    ...(type ? { actualType: type } : {}),
    ...(scheduled ? { createdAt: { gt: new Date() } } : {}),
    ...(q
      ? {
          OR: [
            { text: { contains: q, mode: "insensitive" as const } },
            { author: { username: { contains: q.toLowerCase() } } },
          ],
        }
      : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        text: true,
        actualType: true,
        createdAt: true,
        likeCount: true,
        humanGuessCount: true,
        aiGuessCount: true,
        author: { select: { username: true, displayName: true, profileImage: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date().getTime();
  const query = `q=${encodeURIComponent(q)}&type=${type ?? ""}${scheduled ? "&scheduled=1" : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Posts</h1>
        <form className="flex flex-wrap items-center gap-2" method="get">
          <input name="q" defaultValue={q} placeholder="Search text or @username" className="h-9 rounded-lg border border-border bg-bg px-3 text-sm" />
          <select name="type" defaultValue={type ?? ""} className="h-9 rounded-lg border border-border bg-bg px-2 text-sm">
            <option value="">Human + AI</option>
            <option value="HUMAN">Human only</option>
            <option value="AI">AI only</option>
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="scheduled" value="1" defaultChecked={scheduled} /> scheduled only
          </label>
          <button type="submit" className="h-9 rounded-lg bg-fg px-3 text-sm font-medium text-bg">
            Filter
          </button>
        </form>
      </div>

      <p className="text-sm text-fg-muted">{total.toLocaleString()} posts</p>

      <ul className="divide-y divide-border rounded-2xl border border-border">
        {posts.map((p) => {
          const totalGuesses = p.humanGuessCount + p.aiGuessCount;
          const fooled = totalGuesses ? Math.round(((p.actualType === "AI" ? p.humanGuessCount : p.aiGuessCount) / totalGuesses) * 100) : null;
          return (
            <li key={p.id} className="flex gap-3 px-4 py-3">
              <Avatar src={p.author.profileImage} name={p.author.displayName} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/u/${p.author.username}`} target="_blank" className="font-medium hover:underline">
                    {p.author.displayName}
                  </Link>
                  <span className="text-fg-muted">@{p.author.username}</span>
                  <TypeBadge type={p.actualType} />
                  {p.createdAt.getTime() > now && (
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">scheduled</span>
                  )}
                  <span className="text-xs text-fg-faint">{fullDateTime(p.createdAt)}</span>
                </div>
                <p className="post-text mt-1 text-[15px]">{p.text}</p>
                <p className="mt-1 text-xs text-fg-muted tabular-nums">
                  {p.likeCount} likes · {totalGuesses} guesses
                  {fooled !== null && ` · fooled ${fooled}% of guessers`}
                  {" · "}
                  <Link href={`/post/${p.id}`} target="_blank" className="text-accent hover:underline">
                    open
                  </Link>
                </p>
              </div>
              <DeleteButton endpoint={`/api/admin/posts/${p.id}`} confirmText="Delete this post? Guesses on it will be removed from player scores." />
            </li>
          );
        })}
        {posts.length === 0 && <li className="px-4 py-10 text-center text-sm text-fg-muted">No posts match.</li>}
      </ul>

      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`?${query}&page=${page - 1}`} className="rounded-lg border border-border px-3 py-1.5">
              Previous
            </Link>
          )}
          <span className="text-fg-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={`?${query}&page=${page + 1}`} className="rounded-lg border border-border px-3 py-1.5">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
