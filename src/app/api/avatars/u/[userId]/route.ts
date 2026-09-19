import { avatarStorage } from "@/lib/avatars";
import { jsonError, route } from "@/lib/http";

type Ctx = { params: Promise<{ userId: string }> };

/** GET /api/avatars/u/:userId?v=... — an uploaded profile picture. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { userId } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(userId)) return jsonError(404, "Not found");
  const avatar = await avatarStorage.load(userId);
  if (!avatar) return jsonError(404, "Not found");
  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "content-type": avatar.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'",
      "x-content-type-options": "nosniff",
    },
  });
});
