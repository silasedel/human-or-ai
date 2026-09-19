import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export interface LeaderboardEntry {
  id: string;
  username: string;
  displayName: string;
  profileImage: string | null;
  guessCount: number;
  correctCount: number;
  /** 0-100 with one decimal. */
  accuracy: number;
}

/** Best guessers, restricted to players with enough guesses to be meaningful. */
export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const min = env.leaderboardMinGuesses;
  const rows = await prisma.$queryRaw<
    Array<Omit<LeaderboardEntry, "accuracy"> & { accuracy: number | null }>
  >`
    SELECT "id", "username", "displayName", "profileImage", "guessCount", "correctCount",
           ("correctCount"::float8 / NULLIF("guessCount", 0)) AS accuracy
    FROM "User"
    WHERE "accountType" = 'HUMAN' AND "guessCount" >= ${min}
    ORDER BY accuracy DESC NULLS LAST, "guessCount" DESC, "createdAt" ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ ...r, accuracy: Math.round((r.accuracy ?? 0) * 1000) / 10 }));
}

export interface SiteStats {
  posts: number;
  players: number;
  guesses: number;
  correctGuesses: number;
  /** 0-100 with one decimal. */
  overallAccuracy: number;
}

export async function getSiteStats(): Promise<SiteStats> {
  const [posts, players, guesses, correctGuesses] = await Promise.all([
    prisma.post.count({ where: { createdAt: { lte: new Date() } } }),
    prisma.user.count({ where: { accountType: "HUMAN" } }),
    prisma.guess.count(),
    prisma.guess.count({ where: { correct: true } }),
  ]);
  return {
    posts,
    players,
    guesses,
    correctGuesses,
    overallAccuracy: guesses ? Math.round((correctGuesses / guesses) * 1000) / 10 : 0,
  };
}

export interface AdminStats extends SiteStats {
  humanPosts: number;
  aiPosts: number;
  aiAccounts: number;
  scheduledPosts: number;
  likes: number;
  guessesLast24h: number;
  postsLast24h: number;
  signupsLast24h: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [base, humanPosts, aiPosts, aiAccounts, scheduledPosts, likes, guessesLast24h, postsLast24h, signupsLast24h] =
    await Promise.all([
      getSiteStats(),
      prisma.post.count({ where: { actualType: "HUMAN" } }),
      prisma.post.count({ where: { actualType: "AI", createdAt: { lte: new Date() } } }),
      prisma.user.count({ where: { accountType: "AI" } }),
      prisma.post.count({ where: { createdAt: { gt: new Date() } } }),
      prisma.like.count(),
      prisma.guess.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.post.count({ where: { createdAt: { gte: dayAgo, lte: new Date() } } }),
      prisma.user.count({ where: { accountType: "HUMAN", createdAt: { gte: dayAgo } } }),
    ]);
  return { ...base, humanPosts, aiPosts, aiAccounts, scheduledPosts, likes, guessesLast24h, postsLast24h, signupsLast24h };
}
