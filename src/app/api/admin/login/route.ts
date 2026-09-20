import { NextResponse } from "next/server";
import { z } from "zod";
import { adminConfigProblem, createAdminSession, isAdminConfigured, verifyAdminPassword } from "@/lib/admin-auth";
import { assertSameOrigin, getClientIp, jsonError, readJson, route } from "@/lib/http";
import { describeWait } from "@/lib/login-guard";
import { checkRateLimit, clearRateLimit, enforceRateLimit, peekRateLimit } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(1).max(200) });

/** Fixed key: cannot be varied through request headers. */
const GLOBAL_FAILURE_KEY = "admin-login:fail:global";
const GLOBAL_WINDOW_SECONDS = 15 * 60;
/**
 * Generous on purpose. The password is required to be 16+ characters of real
 * entropy, so this is defence in depth, not the primary control; a tighter cap
 * would let anyone lock the real admin out by flooding the endpoint. Only
 * FAILURES count, and a successful sign-in clears the counter immediately.
 */
const GLOBAL_FAILURE_LIMIT = 100;

/** POST /api/admin/login { password } */
export const POST = route(async (req) => {
  assertSameOrigin(req);

  if (!isAdminConfigured()) {
    return jsonError(503, adminConfigProblem() ?? "Admin is not configured");
  }

  // Header-independent throttle, checked without consuming the budget.
  const global = await peekRateLimit(GLOBAL_FAILURE_KEY);
  if (global && global.count >= GLOBAL_FAILURE_LIMIT) {
    return jsonError(429, `Too many failed admin sign-ins. Try again in ${describeWait(global.resetAt)}.`);
  }

  // Extra per-IP layer, only when the address comes from a source we trust.
  const ip = getClientIp(req);
  if (ip) await enforceRateLimit(`admin-login:ip:${ip}`, 10, GLOBAL_WINDOW_SECONDS);

  const { password } = await readJson(req, schema);

  if (!verifyAdminPassword(password)) {
    await checkRateLimit(GLOBAL_FAILURE_KEY, GLOBAL_FAILURE_LIMIT, GLOBAL_WINDOW_SECONDS);
    return jsonError(401, "Wrong password");
  }

  await clearRateLimit(GLOBAL_FAILURE_KEY);
  await createAdminSession();
  return NextResponse.json({ ok: true });
});
