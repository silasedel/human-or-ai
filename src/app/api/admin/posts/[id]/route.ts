import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, jsonError, route } from "@/lib/http";
import { deletePostCascade } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/admin/posts/:id */
export const DELETE = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (!post) return jsonError(404, "Post not found");
  await deletePostCascade(id);
  return NextResponse.json({ ok: true });
});
