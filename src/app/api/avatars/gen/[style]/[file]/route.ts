import { isAvatarStyle, renderGeneratedAvatar } from "@/lib/avatars";
import { jsonError, route } from "@/lib/http";

type Ctx = { params: Promise<{ style: string; file: string }> };

/** GET /api/avatars/gen/:style/:seed.svg — deterministic generated avatar. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { style, file } = await params;
  if (!isAvatarStyle(style) || !file.endsWith(".svg")) return jsonError(404, "Not found");
  const seed = decodeURIComponent(file.slice(0, -4)).slice(0, 80);
  if (!seed) return jsonError(404, "Not found");
  const svg = renderGeneratedAvatar(style, seed);
  if (!svg) return jsonError(404, "Not found");
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
});
