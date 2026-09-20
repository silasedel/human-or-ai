import "server-only";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

export const ADMIN_COOKIE = "hoa_admin";
const ADMIN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * The admin area is enabled only when BOTH the password and the cookie signing
 * key are real deployment secrets. A placeholder or weak value disables admin
 * entirely (fail closed) instead of accepting a credential that is public in
 * .env.example. `adminConfigProblem()` explains why when it is disabled.
 */
export function isAdminConfigured(): boolean {
  return env.adminPasswordCheck.ok && env.sessionSecretCheck.ok;
}

/** Why the admin area is disabled, or null when it is properly configured. */
export function adminConfigProblem(): string | null {
  if (!env.adminPasswordCheck.ok) return env.adminPasswordCheck.reason ?? "ADMIN_PASSWORD is invalid";
  if (!env.sessionSecretCheck.ok) return env.sessionSecretCheck.reason ?? "SESSION_SECRET is invalid";
  return null;
}

export function verifyAdminPassword(input: string): boolean {
  if (!isAdminConfigured()) return false;
  // Hash both sides so lengths match and the comparison is constant-time.
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(env.adminPassword).digest();
  return timingSafeEqual(a, b);
}

function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.isProduction,
    path: "/",
    maxAge,
  };
}

export async function createAdminSession(): Promise<void> {
  if (!isAdminConfigured()) throw new HttpError(503, "Admin is not configured");
  const exp = Date.now() + ADMIN_TTL_SECONDS * 1000;
  const value = `${exp}.${sign(`admin:${exp}`)}`;
  const store = await cookies();
  store.set(ADMIN_COOKIE, value, adminCookieOptions(ADMIN_TTL_SECONDS));
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", adminCookieOptions(0));
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(sig, sign(`admin:${expStr}`));
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    throw new HttpError(403, "Admin authentication required");
  }
}
