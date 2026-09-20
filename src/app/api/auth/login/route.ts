import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, getGuestId, migrateGuestGuesses, verifyPin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, getClientIp, jsonError, readJson, route } from "@/lib/http";
import { assertIpNotLocked, lockedError, recordLoginFailure, recordLoginSuccess } from "@/lib/login-guard";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

// Compared against when the username doesn't exist, so timing doesn't reveal it.
const DUMMY_HASH = bcrypt.hashSync("no-such-user", 10);

/**
 * POST /api/auth/login { username, pin }
 *
 * A PIN is short, so sign-in is defended in layers:
 *  1. short fixed windows per IP (30 / 15 min) and per username (10 / 15 min);
 *  2. cumulative failure counts with escalating locks per account and per IP
 *     (see src/lib/login-guard.ts), which make enumerating all PINs take years;
 *  3. weak PINs are rejected at sign-up, so spraying "1234" gets nowhere.
 */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { username, pin } = await readJson(req, loginSchema);
  const ip = getClientIp(req);

  await enforceRateLimit(`login:ip:${ip}`, 30, 15 * 60);
  await enforceRateLimit(`login:user:${username}`, 10, 15 * 60);
  await assertIpNotLocked(ip);

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, pinHash: true, accountType: true, lockedUntil: true },
  });
  const isHuman = Boolean(user && user.accountType === "HUMAN");

  if (user && isHuman && user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw lockedError(user.lockedUntil);
  }

  const ok = await verifyPin(pin, user?.pinHash ?? DUMMY_HASH);
  if (!user || !isHuman || !ok) {
    await recordLoginFailure(user && isHuman ? user.id : null, ip);
    return jsonError(401, "Wrong username or PIN");
  }

  const failedAttempts = await recordLoginSuccess(user.id);

  const guestId = await getGuestId();
  if (guestId) await migrateGuestGuesses(guestId, user.id);
  await createSession(user.id);

  return NextResponse.json({ ok: true, username: user.username, failedAttempts });
});
