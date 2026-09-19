import Link from "next/link";
import { getAdminStats } from "@/lib/stats";
import { getProviderStatus } from "@/lib/ai/provider";
import { Card } from "@/components/ui";

export default async function AdminDashboard() {
  const [stats, provider] = await Promise.all([getAdminStats(), Promise.resolve(getProviderStatus())]);

  const tiles: Array<[string, string | number, string?]> = [
    ["Posts (live)", stats.posts, `${stats.humanPosts} human · ${stats.aiPosts} AI`],
    ["Scheduled AI posts", stats.scheduledPosts, "appear when their time comes"],
    ["Human accounts", stats.players, `${stats.signupsLast24h} in the last 24h`],
    ["AI accounts", stats.aiAccounts],
    ["Guesses", stats.guesses, `${stats.guessesLast24h} in the last 24h`],
    ["Overall accuracy", stats.guesses ? `${stats.overallAccuracy.toFixed(1)}%` : "—", "how often humans are right"],
    ["Likes", stats.likes],
    ["Posts in last 24h", stats.postsLast24h],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([label, value, hint]) => (
          <Card key={label} className="p-4">
            <div className="text-xs font-medium text-fg-muted">{label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</div>
            {hint && <div className="mt-0.5 text-[11px] text-fg-faint">{hint}</div>}
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="font-semibold">AI generation</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Provider <span className="font-mono text-fg">{provider.provider}</span> · model{" "}
          <span className="font-mono text-fg">{provider.model}</span> ·{" "}
          <span className={provider.configured ? "text-success" : "text-danger"}>{provider.detail}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/admin/generate" className="font-medium text-accent hover:underline">
            Generate posts
          </Link>
          <span className="text-fg-faint">·</span>
          <Link href="/admin/ai-profiles" className="font-medium text-accent hover:underline">
            Manage AI profiles
          </Link>
          <span className="text-fg-faint">·</span>
          <Link href="/admin/posts" className="font-medium text-accent hover:underline">
            Review posts
          </Link>
        </div>
      </Card>
    </div>
  );
}
