import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { avatarStorage, detectImageMime, MAX_AVATAR_BYTES, randomGeneratedAvatarUrl } from "@/lib/avatars";
import { prisma } from "@/lib/db";
import { assertSameOrigin, jsonError, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

/** POST /api/profile/avatar (multipart form, field "file") — upload a profile picture. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await enforceRateLimit(`avatar:${user.id}`, 20, 60 * 60);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Expected a multipart form upload");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return jsonError(400, "No file provided");
  if (file.size > MAX_AVATAR_BYTES) return jsonError(413, "Image is too large (max 512 KB after resizing)");

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectImageMime(buffer);
  if (!mime) return jsonError(415, "Only PNG, JPEG, WebP and GIF images are accepted");

  const url = await avatarStorage.save(user.id, buffer, mime);
  await prisma.user.update({ where: { id: user.id }, data: { profileImage: url } });
  return NextResponse.json({ ok: true, profileImage: url });
});

/** DELETE /api/profile/avatar — remove the upload and fall back to a generated avatar. */
export const DELETE = route(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await avatarStorage.remove(user.id);
  const url = randomGeneratedAvatarUrl(user.username);
  await prisma.user.update({ where: { id: user.id }, data: { profileImage: url } });
  return NextResponse.json({ ok: true, profileImage: url });
});
