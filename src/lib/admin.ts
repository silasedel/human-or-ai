import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { deletePostCascade } from "@/lib/posts";

/**
 * Delete an account (human or AI) and everything it owns, keeping the
 * denormalized counters of everyone else consistent.
 */
export async function deleteUserCascade(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new HttpError(404, "User not found");

  // Their posts: other players' guesses on them go away, so fix those scores.
  const posts = await prisma.post.findMany({ where: { authorId: userId }, select: { id: true } });
  for (const post of posts) {
    await deletePostCascade(post.id);
  }

  // Their guesses: remove them from the per-post tallies.
  const guesses = await prisma.guess.findMany({ where: { userId }, select: { postId: true, guessedType: true } });
  await prisma.$transaction(async (tx) => {
    for (const g of guesses) {
      await tx.post.update({
        where: { id: g.postId },
        data: g.guessedType === "HUMAN" ? { humanGuessCount: { decrement: 1 } } : { aiGuessCount: { decrement: 1 } },
      });
    }
    // Their likes: decrement like counts.
    const likes = await tx.like.findMany({ where: { userId }, select: { postId: true } });
    for (const l of likes) {
      await tx.post.update({ where: { id: l.postId }, data: { likeCount: { decrement: 1 } } });
    }
    await tx.user.delete({ where: { id: userId } });
  });
}
