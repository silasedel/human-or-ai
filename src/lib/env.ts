/**
 * Typed access to environment variables. Everything here is server-only;
 * never import this file from a client component.
 */
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  /** Secret used to sign the admin cookie. Required in production. */
  get sessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("SESSION_SECRET must be set to a long random string in production");
      }
      return "dev-only-insecure-secret-change-me";
    }
    return secret;
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
