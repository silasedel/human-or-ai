"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorText, Hint, Input, Label, TextArea } from "@/components/ui";

const selects = {
  capitalization: ["lowercase", "normal", "mixed"],
  punctuation: ["none", "minimal", "normal", "heavy"],
  emoji: ["never", "rare", "sometimes", "often"],
  length: ["very short", "short", "medium", "long", "mixed"],
  slang: ["none", "light", "heavy"],
  grammar: ["sloppy", "casual", "clean"],
} as const;

type SelectKey = keyof typeof selects;

export function AiProfileForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    bio: "",
    postingWeight: "1",
    summary: "",
    voice: "",
    interests: "",
    quirks: "",
    capitalization: "normal",
    punctuation: "minimal",
    emoji: "rare",
    length: "mixed",
    slang: "light",
    grammar: "casual",
    asksQuestions: false,
    tellsStories: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai-profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          displayName: form.displayName,
          bio: form.bio,
          postingWeight: Number(form.postingWeight),
          persona: {
            summary: form.summary,
            voice: form.voice,
            interests: form.interests.split(",").map((s) => s.trim()).filter(Boolean),
            quirks: form.quirks.split("\n").map((s) => s.trim()).filter(Boolean),
            capitalization: form.capitalization,
            punctuation: form.punctuation,
            emoji: form.emoji,
            length: form.length,
            slang: form.slang,
            grammar: form.grammar,
            asksQuestions: form.asksQuestions,
            tellsStories: form.tellsStories,
          },
        }),
      });
      const data = (await res.json()) as { error?: string; username?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create profile");
      setMessage(`Created @${data.username}. Generate some posts for it on the Generate page.`);
      setForm((f) => ({ ...f, username: "", displayName: "", bio: "", summary: "", voice: "", interests: "", quirks: "" }));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="font-semibold">New AI profile</h2>
      <p className="mt-1 text-xs text-fg-muted">The persona is what the generator reads. Be specific about how they type.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ai-username">Username</Label>
            <Input id="ai-username" value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} required />
          </div>
          <div>
            <Label htmlFor="ai-displayName">Display name</Label>
            <Input id="ai-displayName" value={form.displayName} onChange={(e) => set("displayName", e.target.value.slice(0, 40))} required />
          </div>
        </div>
        <div>
          <Label htmlFor="ai-bio">Bio</Label>
          <Input id="ai-bio" value={form.bio} onChange={(e) => set("bio", e.target.value.slice(0, 160))} placeholder="short profile bio" />
        </div>
        <div>
          <Label htmlFor="ai-summary">Who they are</Label>
          <Input id="ai-summary" value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="24 year old line cook who posts after closing" required />
        </div>
        <div>
          <Label htmlFor="ai-voice">How they write</Label>
          <TextArea id="ai-voice" rows={4} value={form.voice} onChange={(e) => set("voice", e.target.value)} placeholder="Lowercase, tired, dry. Complains about the walk-in. Mentions the dish pit. Never explains jokes..." required />
        </div>
        <div>
          <Label htmlFor="ai-interests">Interests (comma separated)</Label>
          <Input id="ai-interests" value={form.interests} onChange={(e) => set("interests", e.target.value)} placeholder="the kitchen, the bus, energy drinks" />
        </div>
        <div>
          <Label htmlFor="ai-quirks">Quirks (one per line)</Label>
          <TextArea id="ai-quirks" rows={2} value={form.quirks} onChange={(e) => set("quirks", e.target.value)} placeholder={"calls everyone 'chef'\nno apostrophes"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(selects) as SelectKey[]).map((key) => (
            <div key={key}>
              <Label htmlFor={`ai-${key}`} className="capitalize">
                {key}
              </Label>
              <select
                id={`ai-${key}`}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-bg px-2 text-sm"
              >
                {selects[key].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <Label htmlFor="ai-weight">Posting weight</Label>
            <Input id="ai-weight" type="number" min="0.1" max="5" step="0.1" value={form.postingWeight} onChange={(e) => set("postingWeight", e.target.value)} />
            <Hint>1 = average frequency</Hint>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.asksQuestions} onChange={(e) => set("asksQuestions", e.target.checked)} /> asks questions
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.tellsStories} onChange={(e) => set("tellsStories", e.target.checked)} /> tells stories
          </label>
        </div>
        <ErrorText>{error}</ErrorText>
        {message && <p className="text-sm text-success">{message}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Create AI profile
        </Button>
      </form>
    </Card>
  );
}
