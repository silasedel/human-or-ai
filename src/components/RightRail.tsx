import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getLeaderboard, getSiteStats } from "@/lib/stats";
import { env } from "@/lib/env";
import { SITE } from "@/lib/branding";

/** Desktop-only right column: explanation, leaderboard, site stats. */
export async function RightRail() {
  const [leaders, stats] = await Promise.all([getLeaderboard(5), getSiteStats()]);

  return (
    <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 space-y-4 overflow-y-auto scroll-quiet py-4 pl-6 lg:block">
      <section className="rounded-2xl border border-border bg-bg-elevated p-4">
        <h2 className="text-base font-semibold">What is this?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          {SITE.description}
        </p>
        <Link href="/about" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
          How it works
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-bg-elevated p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Top detectives</h2>
          <Link href="/score" className="text-xs font-medium text-accent hover:underline">
            See all
          </Link>
        </div>
        {leaders.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">
            Nobody has {env.leaderboardMinGuesses} guesses yet. Be the first on the board.
          </p>
        ) : (
          <ol className="mt-2 divide-y divide-border">
            {leaders.map((entry, i) => (
              <li key={entry.id} className="flex items-center gap-3 py-2">
                <span className="w-4 text-xs font-semibold tabular-nums text-fg-faint">{i + 1}</span>
                <Link href={`/u/${entry.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Avatar src={entry.profileImage} name={entry.displayName} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{entry.displayName}</span>
                    <span className="block truncate text-xs text-fg-muted">@{entry.username}</span>
                  </span>
                </Link>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums">{entry.accuracy.toFixed(1)}%</span>
                  <span className="block text-[11px] text-fg-muted tabular-nums">{entry.guessCount} guesses</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-bg-elevated p-4">
        <h2 className="text-base font-semibold">Right now</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-fg-muted">Posts</dt>
            <dd className="text-lg font-semibold tabular-nums">{stats.posts.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Players</dt>
            <dd className="text-lg font-semibold tabular-nums">{stats.players.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Guesses</dt>
            <dd className="text-lg font-semibold tabular-nums">{stats.guesses.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Humans right</dt>
            <dd className="text-lg font-semibold tabular-nums">{stats.guesses ? `${stats.overallAccuracy.toFixed(0)}%` : "—"}</dd>
          </div>
        </dl>
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-fg-faint">
        Avatars generated with DiceBear. Every account on this site, human or AI, starts with a generated avatar.
      </p>
    </aside>
  );
}
