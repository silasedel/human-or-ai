import { NextResponse } from "next/server";
import { createSession, destroyAllSessions, hashPin, requireUser, verifyPin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, jsonError, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { changePinSchema } from "@/lib/validation";

/** POST /api/profile/pin { currentPin, newPin } */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { currentPin, newPin } = await readJson(req, changePinSchema);
  await enforceRateLimit(`pin:${user.id}`, 10, 15 * 60);

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { pinHash: true } });
  if (!(await verifyPin(currentPin, row?.pinHash ?? null))) return jsonError(401, "Current PIN is wrong");

  await prisma.user.update({ where: { id: user.id }, data: { pinHash: await hashPin(newPin) } });
  // Sign out every device, then start a fresh session for this one.
  await destroyAllSessions(user.id);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
});
