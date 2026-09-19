import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getLeaderboard, getSiteStats } from "@/lib/stats";
import { accuracyPct } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { Button, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Score" };
export const dynamic = "force-dynamic";

export default async function ScorePage() {
  const [user, leaders, stats] = await Promise.all([getCurrentUser(), getLeaderboard(25), getSiteStats()]);
  const min = env.leaderboardMinGuesses;

  return (
    <div>
      <PageHeader title="Score" subtitle="How good are you at spotting the machines?" />

      <div className="space-y-6 px-4 py-5 md:px-5">
        {user ? (
          <section className="rounded-2xl border border-border bg-bg-elevated p-5">
            <div className="flex items-center gap-3">
              <Avatar src={user.profileImage} name={user.displayName} size={48} />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">AI Detective Score</div>
                <div className="font-semibold">{user.displayName}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="guesses" value={user.guessCount.toLocaleString()} />
              <Stat label="correct" value={user.correctCount.toLocaleString()} />
              <Stat label="accuracy" value={user.guessCount ? `${accuracyPct(user.correctCount, user.guessCount).toFixed(1)}%` : "—"} />
            </div>
            <p className="mt-3 text-xs text-fg-muted">
              {user.guessCount >= min
                ? "You qualify for the leaderboard."
                : `Make ${min - user.guessCount} more ${min - user.guessCount === 1 ? "guess" : "guesses"} to appear on the leaderboard.`}
              {stats.guesses > 0 && ` Everyone combined is right ${stats.overallAccuracy.toFixed(0)}% of the time.`}
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-bg-elevated p-5">
            <h2 className="font-semibold">Keep score</h2>
            <p className="mt-1 text-sm text-fg-muted">
              You can guess as a guest, but an account keeps your running accuracy and puts you on the board.
              Guest guesses carry over when you sign up.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/signup">
                <Button size="sm">Create account</Button>
              </Link>
              <Link href="/login">
                <Button size="sm" variant="secondary">
                  Sign in
                </Button>
              </Link>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold">
              <Trophy size={18} className="text-accent" /> Leaderboard
            </h2>
            <span className="text-xs text-fg-muted">min. {min} guesses</span>
          </div>
          {leaders.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-fg-muted">
              Nobody has made {min} guesses yet. The board is wide open.
            </p>
          ) : (
            <ol className="mt-3 overflow-hidden rounded-2xl border border-border">
              {leaders.map((entry, i) => (
                <li key={entry.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <span className="w-6 text-sm font-bold tabular-nums text-fg-faint">{i + 1}</span>
                  <Link href={`/u/${entry.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={entry.profileImage} name={entry.displayName} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{entry.displayName}</span>
                      <span className="block truncate text-xs text-fg-muted">@{entry.username}</span>
                    </span>
                  </Link>
                  <span className="text-right">
                    <span className="block text-base font-bold tabular-nums">{entry.accuracy.toFixed(1)}%</span>
                    <span className="block text-[11px] text-fg-muted tabular-nums">
                      {entry.correctCount}/{entry.guessCount} guesses
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-fg-muted">{label}</div>
    </div>
  );
}
