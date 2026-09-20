import "server-only";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Brute-force protection for PIN sign-in.
 *
 * A 4-digit PIN has only 10,000 values, so per-window rate limits alone are
 * not enough: an attacker could enumerate the space over days. On top of the
 * short windows in the login route, failures are counted *cumulatively*:
 *
 *  - per account: reset only by a successful sign-in; after 5 free attempts
 *    every further 5 failures lock the account for 1 min, 5 min, 30 min, 2 h,
 *    12 h, then 24 h. From then on an account allows 5 attempts a day, so a
 *    full enumeration would take years rather than days.
 *  - per IP (24h window): looser, because many people can share an IP. After
 *    20 free attempts every further 10 failures lock the IP for 1 min, 5 min,
 *    15 min, 1 h, 6 h, then 24 h. This blunts "spray 1234 at every username".
 */

interface LockPolicy {
  /** Failures allowed before the first lock. */
  free: number;
  /** Failures between subsequent locks. */
  per: number;
  /** Lock durations in seconds; the last one repeats. */
  schedule: number[];
}

export const ACCOUNT_POLICY: LockPolicy = {
  free: 5,
  per: 5,
  schedule: [60, 5 * 60, 30 * 60, 2 * 3600, 12 * 3600, 24 * 3600],
};

export const IP_POLICY: LockPolicy = {
  free: 20,
  per: 10,
  schedule: [60, 5 * 60, 15 * 60, 3600, 6 * 3600, 24 * 3600],
};

/** Lock duration (seconds) after `failures` consecutive failures under a policy. */
export function lockSecondsFor(failures: number, policy: LockPolicy): number {
  if (failures < policy.free) return 0;
  const step = Math.floor((failures - policy.free) / policy.per);
  return policy.schedule[Math.min(step, policy.schedule.length - 1)];
}

/** Whether this failure count is one that starts a (new) lock. */
function triggersLock(failures: number, policy: LockPolicy): boolean {
  return failures >= policy.free && (failures - policy.free) % policy.per === 0;
}

export function describeWait(until: Date): string {
  const seconds = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function lockedError(until: Date): HttpError {
  return new HttpError(429, `Too many failed sign-in attempts. Try again in ${describeWait(until)}.`, {
    lockedUntil: until.toISOString(),
  });
}

interface LockRow {
  resetAt: Date;
}

/** Throws if this IP is currently locked out of signing in. */
export async function assertIpNotLocked(ip: string): Promise<void> {
  const rows = await prisma.$queryRaw<LockRow[]>`
    SELECT "resetAt" FROM "RateLimit" WHERE "key" = ${`lock:ip:${ip}`} AND "resetAt" > now()
  `;
  if (rows.length) throw lockedError(rows[0].resetAt);
}

async function setLock(key: string, seconds: number): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${seconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "resetAt" = GREATEST("RateLimit"."resetAt", EXCLUDED."resetAt")
  `;
}

/**
 * Record a failed sign-in. Escalates the account lock (when the username
 * belongs to a real human account) and the IP lock. Never throws; the caller
 * always returns the same generic 401.
 */
export async function recordLoginFailure(userId: string | null, ip: string | null): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (userId) {
    tasks.push(
      (async () => {
        const user = await prisma.user.update({
          where: { id: userId },
          data: { failedLoginCount: { increment: 1 }, lastFailedLoginAt: new Date() },
          select: { failedLoginCount: true },
        });
        if (triggersLock(user.failedLoginCount, ACCOUNT_POLICY)) {
          const seconds = lockSecondsFor(user.failedLoginCount, ACCOUNT_POLICY);
          await prisma.user.update({
            where: { id: userId },
            data: { lockedUntil: new Date(Date.now() + seconds * 1000) },
          });
        }
      })(),
    );
  }

  if (ip) {
    tasks.push(
      (async () => {
        const { remaining } = await checkRateLimit(`loginfail:ip:${ip}`, 1_000_000, 24 * 3600);
        const failures = 1_000_000 - remaining;
        if (triggersLock(failures, IP_POLICY)) {
          await setLock(`lock:ip:${ip}`, lockSecondsFor(failures, IP_POLICY));
        }
      })(),
    );
  }

  await Promise.all(tasks).catch((err) => console.error("recordLoginFailure:", err));
}

/**
 * Record a successful sign-in: clears the account counters and returns how
 * many failed attempts happened since the previous success (owner notice).
 */
export async function recordLoginSuccess(userId: string): Promise<number> {
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { failedLoginCount: true } });
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
  return before?.failedLoginCount ?? 0;
}
