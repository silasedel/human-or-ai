"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { SITE } from "@/lib/branding";

export function AdminLogin({ configured, problem }: { configured: boolean; problem?: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <ShieldCheck size={26} />
        </span>
        <h1 className="mt-4 text-xl font-bold">{SITE.name} admin</h1>
        <p className="mt-1 text-sm text-fg-muted">Enter the admin password from your environment.</p>
      </div>
      {!configured ? (
        <div className="space-y-2">
          <ErrorText>{problem ?? "Admin is not configured."}</ErrorText>
          <p className="text-xs leading-relaxed text-fg-muted">
            The admin area stays disabled until both <code>ADMIN_PASSWORD</code> and <code>SESSION_SECRET</code> are set to
            unique, high-entropy values. Placeholder values from <code>.env.example</code> are refused on purpose. Generate
            them with <code>openssl rand -base64 24</code> and <code>openssl rand -hex 32</code>, then redeploy.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="password">Admin password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/" className="text-accent hover:underline">
          Back to the site
        </Link>
      </p>
    </div>
  );
}
