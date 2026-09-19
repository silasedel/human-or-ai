import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/Avatar";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { TypeBadge } from "@/components/admin/TypeBadge";
import { fullDateTime } from "@/lib/time";
import { accuracyPct } from "@/lib/utils";

const PAGE_SIZE = 40;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const type: "HUMAN" | "AI" | undefined = sp.type === "HUMAN" || sp.type === "AI" ? sp.type : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.UserWhereInput = {
    ...(type ? { accountType: type } : {}),
    ...(q ? { OR: [{ username: { contains: q } }, { displayName: { contains: q, mode: "insensitive" as const } }] } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        username: true,
        displayName: true,
        profileImage: true,
        accountType: true,
        createdAt: true,
        guessCount: true,
        correctCount: true,
        _count: { select: { posts: true, likes: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <form className="flex flex-wrap items-center gap-2" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search username or name"
            className="h-9 rounded-lg border border-border bg-bg px-3 text-sm"
          />
          <select name="type" defaultValue={type ?? ""} className="h-9 rounded-lg border border-border bg-bg px-2 text-sm">
            <option value="">All types</option>
            <option value="HUMAN">Human</option>
            <option value="AI">AI</option>
          </select>
          <button type="submit" className="h-9 rounded-lg bg-fg px-3 text-sm font-medium text-bg">
            Filter
          </button>
        </form>
      </div>

      <p className="text-sm text-fg-muted">{total.toLocaleString()} accounts</p>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Posts</th>
              <th className="px-3 py-2 text-right">Likes</th>
              <th className="px-3 py-2 text-right">Guesses</th>
              <th className="px-3 py-2 text-right">Accuracy</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  <Link href={`/u/${u.username}`} className="flex items-center gap-2 hover:underline" target="_blank">
                    <Avatar src={u.profileImage} name={u.displayName} size={28} />
                    <span>
                      <span className="font-medium">{u.displayName}</span>{" "}
                      <span className="text-fg-muted">@{u.username}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <TypeBadge type={u.accountType} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{u._count.posts}</td>
                <td className="px-3 py-2 text-right tabular-nums">{u._count.likes}</td>
                <td className="px-3 py-2 text-right tabular-nums">{u.guessCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{u.guessCount ? `${accuracyPct(u.correctCount, u.guessCount).toFixed(1)}%` : "—"}</td>
                <td className="px-3 py-2 text-fg-muted">{fullDateTime(u.createdAt)}</td>
                <td className="px-3 py-2 text-right">
                  <DeleteButton
                    endpoint={`/api/admin/users/${u.id}`}
                    confirmText={`Delete @${u.username} and all of their posts, likes and guesses? This cannot be undone.`}
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-fg-muted">
                  No accounts match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`?q=${encodeURIComponent(q)}&type=${type ?? ""}&page=${page - 1}`} className="rounded-lg border border-border px-3 py-1.5">
              Previous
            </Link>
          )}
          <span className="text-fg-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={`?q=${encodeURIComponent(q)}&type=${type ?? ""}&page=${page + 1}`} className="rounded-lg border border-border px-3 py-1.5">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
