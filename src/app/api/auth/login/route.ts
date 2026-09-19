import { NextResponse } from "next/server";
import { createSession, getGuestId, migrateGuestGuesses, verifyPin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, getClientIp, jsonError, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

/**
 * POST /api/auth/login { username, pin }
 * A 4-digit PIN has only 10,000 combinations, so login is rate limited per
 * username (10 tries / 15 min) and per IP (30 tries / 15 min).
 */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { username, pin } = await readJson(req, loginSchema);
  const ip = getClientIp(req);

  await enforceRateLimit(`login:ip:${ip}`, 30, 15 * 60);
  await enforceRateLimit(`login:user:${username}`, 10, 15 * 60);

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, pinHash: true, accountType: true },
  });

  // Always run a compare so timing doesn't reveal whether the username exists.
  const ok = await verifyPin(pin, user?.pinHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || user.accountType !== "HUMAN" || !ok) {
    return jsonError(401, "Wrong username or PIN");
  }

  const guestId = await getGuestId();
  if (guestId) await migrateGuestGuesses(guestId, user.id);
  await createSession(user.id);

  return NextResponse.json({ ok: true, username: user.username });
});
