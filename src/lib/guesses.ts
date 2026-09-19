import { Prisma, type AuthorType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { guessPercentages, type GuessRevealDTO } from "@/lib/feed";

export interface GuessResult extends GuessRevealDTO {
  postId: string;
  /** True when the viewer had already guessed and we just returned the reveal. */
  alreadyGuessed: boolean;
  /** Updated running stats for logged-in players. */
  stats: { guessCount: number; correctCount: number } | null;
}

interface SubmitGuessArgs {
  postId: string;
  guess: AuthorType;
  userId: string | null;
  guestId: string | null;
}

/**
 * Record a guess exactly once per viewer per post, update the post's tallies
 * and the player's score, then reveal the truth.
 */
export async function submitGuess({ postId, guess, userId, guestId }: SubmitGuessArgs): Promise<GuessResult> {
  if (!userId && !guestId) throw new HttpError(400, "Missing viewer identity");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, actualType: true, authorId: true, createdAt: true, humanGuessCount: true, aiGuessCount: true },
  });
  if (!post || post.createdAt.getTime() > Date.now()) throw new HttpError(404, "Post not found");
  if (userId && post.authorId === userId) throw new HttpError(400, "You can't guess on your own post");

  const ownerWhere = userId ? { userId, postId } : { guestId: guestId!, postId };

  const existing = await prisma.guess.findFirst({ where: ownerWhere });
  if (existing) {
    return revealExisting(existing.guessedType, existing.correct, post, postId, userId);
  }

  const correct = guess === post.actualType;
  try {
    const { updatedPost, stats } = await prisma.$transaction(async (tx) => {
      await tx.guess.create({
        data: {
          postId,
          userId,
          guestId: userId ? null : guestId,
          guessedType: guess,
          correct,
        },
      });
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: guess === "HUMAN" ? { humanGuessCount: { increment: 1 } } : { aiGuessCount: { increment: 1 } },
        select: { humanGuessCount: true, aiGuessCount: true },
      });
      const stats = userId
        ? await tx.user.update({
            where: { id: userId },
            data: { guessCount: { increment: 1 }, correctCount: { increment: correct ? 1 : 0 } },
            select: { guessCount: true, correctCount: true },
          })
        : null;
      return { updatedPost, stats };
    });

    return {
      postId,
      guessedType: guess,
      correct,
      actualType: post.actualType,
      ...guessPercentages(updatedPost.humanGuessCount, updatedPost.aiGuessCount),
      alreadyGuessed: false,
      stats,
    };
  } catch (err) {
    // Two rapid clicks can race past the findFirst above; the unique index wins.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await prisma.guess.findFirst({ where: ownerWhere });
      if (raced) return revealExisting(raced.guessedType, raced.correct, post, postId, userId);
    }
    throw err;
  }
}

async function revealExisting(
  guessedType: AuthorType,
  correct: boolean,
  post: { actualType: AuthorType; humanGuessCount: number; aiGuessCount: number },
  postId: string,
  userId: string | null,
): Promise<GuessResult> {
  const stats = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { guessCount: true, correctCount: true } })
    : null;
  return {
    postId,
    guessedType,
    correct,
    actualType: post.actualType,
    ...guessPercentages(post.humanGuessCount, post.aiGuessCount),
    alreadyGuessed: true,
    stats,
  };
}
