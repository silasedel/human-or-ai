import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Owner alert shown right after signing in when there were failed attempts
 * against the account since the previous successful sign-in.
 */
export function SecurityNotice({ attempts }: { attempts: number }) {
  return (
    <div className="flex items-start gap-3 border-b border-ai/30 bg-ai-soft/70 px-4 py-3 text-sm md:px-5">
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-ai" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg">
          {attempts} failed sign-in {attempts === 1 ? "attempt" : "attempts"} on your account before this one.
        </p>
        <p className="mt-0.5 text-fg-muted">
          If that wasn&apos;t you, pick a new PIN now. Longer PINs (up to 8 digits) are allowed.{" "}
          <Link href="/settings" className="font-medium text-accent hover:underline">
            Change PIN
          </Link>
          <span className="mx-1.5 text-fg-faint">·</span>
          <Link href="/" className="font-medium text-fg-muted hover:underline">
            Dismiss
          </Link>
        </p>
      </div>
    </div>
  );
}
