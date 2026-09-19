"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { Button, ErrorText, Hint, Input, Label } from "@/components/ui";
import { SITE } from "@/lib/branding";

interface AuthFormProps {
  mode: "signup" | "login";
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isSignup ? { username, displayName, pin } : { username, pin }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10 md:py-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size={48} />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{isSignup ? `Join ${SITE.name}` : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {isSignup ? "A username, a name, and a 4-digit PIN. That's it." : "Sign in with your username and PIN."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            placeholder="e.g. sam_k"
            required
          />
          {isSignup && <Hint>3–20 characters. Letters, numbers, underscores.</Hint>}
        </div>

        {isSignup && (
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
              placeholder="What people see on your posts"
              required
            />
          </div>
        )}

        <div>
          <Label htmlFor="pin">4-digit PIN</Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="tracking-[0.4em]"
            required
          />
          {isSignup && <Hint>You&apos;ll use this to sign back in. It&apos;s stored hashed, never in plain text.</Hint>}
        </div>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!username || pin.length !== 4 || (isSignup && !displayName)}>
          {isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
