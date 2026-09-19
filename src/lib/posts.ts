import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { hydratePosts, postSelect, type PostDTO } from "@/lib/feed";

/**
 * Create a post for a logged-in account. The true author type is copied from
 * the account (humans post as HUMAN); the poster never chooses it.
 */
export async function createPost(userId: string, text: string): Promise<PostDTO> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true } });
  if (!user) throw new HttpError(401, "Account not found");

  const row = await prisma.post.create({
    data: { authorId: userId, text, actualType: user.accountType },
    select: postSelect,
  });
  const [dto] = await hydratePosts([row], { userId, guestId: null });
  return dto;
}

/** Owners may delete their own posts. Admin deletion lives in the admin routes. */
export async function deleteOwnPost(userId: string, postId: string): Promise<void> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.authorId !== userId) throw new HttpError(403, "You can only delete your own posts");
  await deletePostCascade(postId);
}

/**
 * Delete a post and keep player stats consistent: guesses on the post are
 * removed, so subtract them from each player's running totals.
 */
export async function deletePostCascade(postId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const guesses = await tx.guess.findMany({
      where: { postId, userId: { not: null } },
      select: { userId: true, correct: true },
    });
    const byUser = new Map<string, { total: number; correct: number }>();
    for (const g of guesses) {
      const entry = byUser.get(g.userId!) ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (g.correct) entry.correct += 1;
      byUser.set(g.userId!, entry);
    }
    for (const [userId, entry] of byUser) {
      await tx.user.update({
        where: { id: userId },
        data: { guessCount: { decrement: entry.total }, correctCount: { decrement: entry.correct } },
      });
    }
    await tx.post.delete({ where: { id: postId } });
  });
}
