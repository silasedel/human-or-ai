"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GenerateResult } from "@/lib/ai/generate";
import type { SeedResult } from "@/lib/seed";
import { Button, Card, ErrorText, Hint, Input, Label } from "@/components/ui";

interface GenerateFormProps {
  providerConfigured: boolean;
  aiAccounts: number;
}

export function GenerateForm({ providerConfigured, aiAccounts }: GenerateFormProps) {
  const router = useRouter();
  const [count, setCount] = useState("20");
  const [hoursBack, setHoursBack] = useState("48");
  const [hoursForward, setHoursForward] = useState("0");
  const [likes, setLikes] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(GenerateResult & { likes?: { likesCreated: number } }) | null>(null);

  const [seedLoading, setSeedLoading] = useState(false);
  const [seedForce, setSeedForce] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          count: Number(count),
          hoursBack: Number(hoursBack),
          hoursForward: Number(hoursForward),
          likes,
          dryRun,
        }),
      });
      const data = (await res.json()) as (GenerateResult & { error?: string; likes?: { likesCreated: number } });
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function seed() {
    if (seedForce && !window.confirm("Re-seed will delete and re-create the posts of every seeded AI account. Continue?")) return;
    setSeedLoading(true);
    setSeedError(null);
    setSeedResult(null);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: seedForce }),
      });
      const data = (await res.json()) as SeedResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Seeding failed");
      setSeedResult(data);
      router.refresh();
    } catch (err) {
      setSeedError((err as Error).message);
    } finally {
      setSeedLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-4">
        <h2 className="font-semibold">Generate a batch</h2>
        <p className="mt-1 text-xs text-fg-muted">
          Posts are spread across AI accounts by posting weight. Each account&apos;s persona and past posts shape its
          voice. Batches of up to 60 run inside one request; use <code>npm run generate-ai-posts</code> for bigger runs.
        </p>
        {!providerConfigured && (
          <ErrorText className="mt-3">No AI provider configured. Add ANTHROPIC_API_KEY (or an OpenAI-compatible key) to your environment.</ErrorText>
        )}
        {aiAccounts === 0 && <ErrorText className="mt-3">There are no AI accounts. Load the seed data below or create a profile first.</ErrorText>}
        <form onSubmit={generate} className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="gen-count">Posts</Label>
              <Input id="gen-count" type="number" min="1" max="60" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gen-back">Hours back</Label>
              <Input id="gen-back" type="number" min="0" max="720" value={hoursBack} onChange={(e) => setHoursBack(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gen-forward">Hours forward</Label>
              <Input id="gen-forward" type="number" min="0" max="168" value={hoursForward} onChange={(e) => setHoursForward(e.target.value)} />
            </div>
          </div>
          <Hint>Timestamps are spread randomly over the window. &quot;Hours forward&quot; schedules posts that appear later, keeping the feed alive.</Hint>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={likes} onChange={(e) => setLikes(e.target.checked)} /> sprinkle AI likes on recent posts
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> dry run (don&apos;t save)
            </label>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} disabled={!providerConfigured || aiAccounts === 0}>
            {loading ? "Generating… this takes a minute" : "Generate"}
          </Button>
        </form>

        {result && (
          <div className="mt-4 rounded-xl border border-border bg-bg-subtle/60 p-3 text-sm">
            <p className="font-medium">
              {result.dryRun ? "Would have created" : "Created"} {result.created} of {result.requested} posts in {result.calls} calls
              {result.failedCalls ? ` (${result.failedCalls} failed)` : ""}, discarded {result.discarded} weak ones.
              {result.likes && ` Added ${result.likes.likesCreated} likes.`}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-danger">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {result.samples.length > 0 && (
              <ul className="mt-2 space-y-1.5 text-xs">
                {result.samples.slice(0, 12).map((s, i) => (
                  <li key={i}>
                    <span className="font-medium text-fg-muted">@{s.username}:</span> {s.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold">Seed data</h2>
        <p className="mt-1 text-xs text-fg-muted">
          Loads the 34 built-in personas and their hand-written posts. Safe to run again: accounts are updated in place
          and posts are only added for accounts that have none.
        </p>
        <label className="mt-3 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={seedForce} onChange={(e) => setSeedForce(e.target.checked)} /> force: wipe and re-create seeded posts
        </label>
        <ErrorText className="mt-3">{seedError}</ErrorText>
        <Button type="button" variant="secondary" className="mt-3" loading={seedLoading} onClick={seed}>
          Load seed personas &amp; posts
        </Button>
        {seedResult && (
          <p className="mt-3 text-sm">
            Accounts: {seedResult.accountsCreated} created, {seedResult.accountsUpdated} updated. Posts: {seedResult.postsCreated} created.
            Likes: {seedResult.likesCreated}. {seedResult.skippedAccounts.length ? `${seedResult.skippedAccounts.length} accounts already had posts.` : ""}
          </p>
        )}
      </Card>
    </div>
  );
}
