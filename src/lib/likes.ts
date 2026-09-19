import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";

export interface LikeResult {
  postId: string;
  liked: boolean;
  likeCount: number;
}

/** Like if not liked, unlike if liked. One like per account per post (enforced by the primary key). */
export async function toggleLike(userId: string, postId: string): Promise<LikeResult> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, createdAt: true } });
  if (!post || post.createdAt.getTime() > Date.now()) throw new HttpError(404, "Post not found");

  const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } });

  if (existing) {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.like.delete({ where: { userId_postId: { userId, postId } } });
      return tx.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
    });
    return { postId, liked: false, likeCount: Math.max(0, updated.likeCount) };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.like.create({ data: { userId, postId } });
      return tx.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
    });
    return { postId, liked: true, likeCount: updated.likeCount };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Double-click race: the like already exists.
      const current = await prisma.post.findUnique({ where: { id: postId }, select: { likeCount: true } });
      return { postId, liked: true, likeCount: current?.likeCount ?? 0 };
    }
    throw err;
  }
}
