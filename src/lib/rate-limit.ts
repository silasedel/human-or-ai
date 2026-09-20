import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";

interface RateLimitRow {
  count: number;
  resetAt: Date;
}

/**
 * Fixed-window rate limiter backed by Postgres so it works across serverless
 * instances. Atomic upsert: increments the counter, or resets it when the
 * window has expired.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now()
                       THEN now() + make_interval(secs => ${windowSeconds})
                       ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows[0];
  const allowed = row.count <= limit;
  return { allowed, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}

/** Throws a 429 HttpError when the limit is exceeded. */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const result = await checkRateLimit(key, limit, windowSeconds);
  if (!result.allowed) {
    const seconds = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
    const minutes = Math.ceil(seconds / 60);
    throw new HttpError(
      429,
      `Too many attempts. Try again in ${minutes > 1 ? `${minutes} minutes` : `${seconds} seconds`}.`,
    );
  }
}

/** Read a window without incrementing it. Returns null when no window is active. */
export async function peekRateLimit(key: string): Promise<{ count: number; resetAt: Date } | null> {
  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    SELECT "count", "resetAt" FROM "RateLimit" WHERE "key" = ${key} AND "resetAt" > now()
  `;
  return rows[0] ?? null;
}

/** Drop a window entirely (e.g. a successful sign-in clears its failure counter). */
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/** Purge expired windows so the table stays small. Called opportunistically. */
export async function pruneRateLimits() {
  await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
