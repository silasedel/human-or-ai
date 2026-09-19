import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createSession, getGuestId, hashPin, migrateGuestGuesses } from "@/lib/auth";
import { randomAvatarCode } from "@/lib/avatar-icons";
import { prisma } from "@/lib/db";
import { assertSameOrigin, getClientIp, jsonError, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validation";

/** POST /api/auth/signup { username, displayName, pin } */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const ip = getClientIp(req);
  await enforceRateLimit(`signup:ip:${ip}`, 10, 60 * 60);

  const { username, displayName, pin } = await readJson(req, signupSchema);

  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) return jsonError(409, "That username is taken");

  let user: { id: string; username: string };
  try {
    user = await prisma.user.create({
      data: {
        username,
        displayName,
        pinHash: await hashPin(pin),
        accountType: "HUMAN",
        profileImage: randomAvatarCode(),
      },
      select: { id: true, username: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(409, "That username is taken");
    }
    throw err;
  }

  const guestId = await getGuestId();
  if (guestId) await migrateGuestGuesses(guestId, user.id);
  await createSession(user.id);

  return NextResponse.json({ ok: true, username: user.username }, { status: 201 });
});
