import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { avatarStorage, randomGeneratedAvatarUrl } from "@/lib/avatars";
import { prisma } from "@/lib/db";
import { assertSameOrigin, route } from "@/lib/http";

/** POST /api/profile/avatar/shuffle — pick a fresh generated avatar. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await avatarStorage.remove(user.id);
  const url = randomGeneratedAvatarUrl(user.username);
  await prisma.user.update({ where: { id: user.id }, data: { profileImage: url } });
  return NextResponse.json({ ok: true, profileImage: url });
});
