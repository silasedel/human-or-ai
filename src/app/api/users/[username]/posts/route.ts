import { NextResponse } from "next/server";
import { getCurrentUser, getGuestId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProfilePosts } from "@/lib/feed";
import { jsonError, readQuery, route } from "@/lib/http";
import { profilePostsQuerySchema } from "@/lib/validation";

type Ctx = { params: Promise<{ username: string }> };

/** GET /api/users/:username/posts?cursor=... */
export const GET = route<Ctx>(async (req, { params }) => {
  const { username } = await params;
  const q = readQuery(req, profilePostsQuerySchema);
  const author = await prisma.user.findUnique({ where: { username: username.toLowerCase() }, select: { id: true } });
  if (!author) return jsonError(404, "User not found");
  const [user, guestId] = await Promise.all([getCurrentUser(), getGuestId()]);
  const page = await getProfilePosts({
    authorId: author.id,
    cursor: q.cursor,
    limit: q.limit,
    viewer: { userId: user?.id ?? null, guestId },
  });
  return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
});
