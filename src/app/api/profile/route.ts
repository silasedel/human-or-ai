import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, jsonError, readJson, route } from "@/lib/http";
import { profileUpdateSchema } from "@/lib/validation";

/** PATCH /api/profile { username, displayName, bio, profileImage? } */
export const PATCH = route(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const data = await readJson(req, profileUpdateSchema);

  if (data.username !== user.username) {
    const taken = await prisma.user.findUnique({ where: { username: data.username }, select: { id: true } });
    if (taken) return jsonError(409, "That username is taken");
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: data.username,
        displayName: data.displayName,
        bio: data.bio,
        ...(typeof data.profileImage === "string" ? { profileImage: data.profileImage } : {}),
      },
      select: { username: true, displayName: true, bio: true, profileImage: true },
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(409, "That username is taken");
    }
    throw err;
  }
});
