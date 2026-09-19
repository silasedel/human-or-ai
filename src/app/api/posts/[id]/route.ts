import { NextResponse } from "next/server";
import { getCurrentUser, getGuestId, requireUser } from "@/lib/auth";
import { getPostById } from "@/lib/feed";
import { assertSameOrigin, jsonError, route } from "@/lib/http";
import { deleteOwnPost } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/posts/:id — a single post as seen by the current viewer. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const [user, guestId] = await Promise.all([getCurrentUser(), getGuestId()]);
  const post = await getPostById(id, { userId: user?.id ?? null, guestId });
  if (!post) return jsonError(404, "Post not found");
  return NextResponse.json(post);
});

/** DELETE /api/posts/:id — delete your own post. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  await deleteOwnPost(user.id, id);
  return NextResponse.json({ ok: true });
});
