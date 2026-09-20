import { checkAdminPassword, checkSessionSecret, type SecretCheck } from "@/lib/secrets";

/**
 * Typed access to environment variables. Everything here is server-only;
 * never import this file from a client component.
 *
 * Secrets are validated rather than merely length-checked: a deployment that
 * keeps a value from .env.example is running with a publicly known credential,
 * so those values are rejected and the admin area fails closed.
 */
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function boolFromEnv(name: string): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export const env = {
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },

  /** True when running on Vercel, whose edge sets a trustworthy client-IP header. */
  get isVercel(): boolean {
    return Boolean(process.env.VERCEL);
  },

  /**
   * Set TRUST_PROXY_HEADERS=1 only when the app sits behind a proxy you control
   * that overwrites X-Forwarded-For. Without it those headers are ignored,
   * because a client can send anything it likes.
   */
  get trustProxyHeaders(): boolean {
    if (boolFromEnv("TRUST_PROXY_HEADERS")) return true;
    // Local development: the only "proxy" is the dev server itself.
    return !this.isProduction;
  },

  /** Validation result for the admin cookie signing key. */
  get sessionSecretCheck(): SecretCheck {
    return checkSessionSecret(process.env.SESSION_SECRET);
  },

  /** Validation result for the admin password. */
  get adminPasswordCheck(): SecretCheck {
    return checkAdminPassword(process.env.ADMIN_PASSWORD);
  },

  /**
   * Secret used to sign the admin cookie. Throws when it is missing, a known
   * placeholder or too weak, so a known key can never produce a valid session.
   * Callers gate on isAdminConfigured() first, which checks the same thing.
   */
  get sessionSecret(): string {
    const check = this.sessionSecretCheck;
    if (!check.ok) throw new Error(check.reason ?? "SESSION_SECRET is invalid");
    return process.env.SESSION_SECRET as string;
  },

  get adminPassword(): string {
    return process.env.ADMIN_PASSWORD ?? "";
  },

  get cronSecret(): string {
    return process.env.CRON_SECRET ?? "";
  },

  get leaderboardMinGuesses(): number {
    return intFromEnv("LEADERBOARD_MIN_GUESSES", 20);
  },

  get aiCronPostCount(): number {
    return intFromEnv("AI_CRON_POST_COUNT", 24);
  },

  get aiProvider(): string {
    return (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  },

  get aiModel(): string | undefined {
    return process.env.AI_MODEL || undefined;
  },
};

/** Every configuration problem worth shouting about at startup. */
export function configProblems(): string[] {
  const problems: string[] = [];
  const session = env.sessionSecretCheck;
  if (!session.ok) problems.push(session.reason!);
  const admin = env.adminPasswordCheck;
  if (!admin.ok) problems.push(admin.reason!);
  return problems;
}
