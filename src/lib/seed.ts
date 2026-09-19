import { prisma } from "@/lib/db";
import { generatedAvatarUrl } from "@/lib/avatars";
import { personaSchema } from "@/lib/ai/personas";
import { AI_ACCOUNTS, type SeedAccount } from "../../prisma/seed-data";

export interface SeedOptions {
  /** Delete existing AI posts/likes for seeded accounts and re-create them. */
  force?: boolean;
  /** Spread seeded post timestamps over this many days (default 14). */
  days?: number;
  log?: (message: string) => void;
}

export interface SeedResult {
  accountsCreated: number;
  accountsUpdated: number;
  postsCreated: number;
  likesCreated: number;
  skippedAccounts: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Random timestamp within the past `days`, denser toward "now"; ~5% scheduled into the next 36h. */
function seedTimestamp(days: number): Date {
  const r = Math.random();
  if (r < 0.05) {
    return new Date(Date.now() + Math.random() * 36 * 60 * 60 * 1000);
  }
  const age = Math.pow(Math.random(), 1.6) * days * DAY_MS;
  return new Date(Date.now() - age);
}

/** Like counts that look like a small, real network: mostly a few, occasionally popular. */
function seedLikeCount(maxLikes: number): number {
  const r = Math.random();
  let n: number;
  if (r < 0.5) n = Math.floor(Math.random() * 3);
  else if (r < 0.82) n = 3 + Math.floor(Math.random() * 6);
  else if (r < 0.96) n = 9 + Math.floor(Math.random() * 12);
  else n = 21 + Math.floor(Math.random() * 14);
  return Math.min(n, maxLikes);
}

/**
 * Create / update the seeded AI personas and their hand-written posts.
 * Idempotent: accounts are upserted; posts are only created for accounts that
 * have none (or for all seeded accounts when `force` is set).
 */
export async function seedAiAccounts(opts: SeedOptions = {}): Promise<SeedResult> {
  const log = opts.log ?? (() => {});
  const days = opts.days ?? 14;
  const result: SeedResult = { accountsCreated: 0, accountsUpdated: 0, postsCreated: 0, likesCreated: 0, skippedAccounts: [] };

  // 1. Accounts
  const idByUsername = new Map<string, string>();
  for (const account of AI_ACCOUNTS) {
    const persona = personaSchema.parse(account.persona);
    const existing = await prisma.user.findUnique({ where: { username: account.username }, select: { id: true } });
    const data = {
      displayName: account.displayName,
      bio: account.bio,
      profileImage: generatedAvatarUrl(account.avatar.style, account.avatar.seed),
      accountType: "AI" as const,
      persona,
      postingWeight: account.postingWeight,
      pinHash: null,
    };
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data });
      idByUsername.set(account.username, existing.id);
      result.accountsUpdated += 1;
    } else {
      const created = await prisma.user.create({ data: { username: account.username, ...data }, select: { id: true } });
      idByUsername.set(account.username, created.id);
      result.accountsCreated += 1;
    }
  }
  log(`Accounts: ${result.accountsCreated} created, ${result.accountsUpdated} updated`);

  // 2. Posts
  const accountsToSeed: SeedAccount[] = [];
  for (const account of AI_ACCOUNTS) {
    const authorId = idByUsername.get(account.username)!;
    const existingPosts = await prisma.post.count({ where: { authorId } });
    if (existingPosts > 0 && !opts.force) {
      result.skippedAccounts.push(account.username);
      continue;
    }
    if (existingPosts > 0 && opts.force) {
      // Deleting posts cascades guesses/likes; keep player stats consistent.
      const guesses = await prisma.guess.findMany({
        where: { post: { authorId }, userId: { not: null } },
        select: { userId: true, correct: true },
      });
      const byUser = new Map<string, { total: number; correct: number }>();
      for (const g of guesses) {
        const e = byUser.get(g.userId!) ?? { total: 0, correct: 0 };
        e.total += 1;
        if (g.correct) e.correct += 1;
        byUser.set(g.userId!, e);
      }
      for (const [userId, e] of byUser) {
        await prisma.user.update({
          where: { id: userId },
          data: { guessCount: { decrement: e.total }, correctCount: { decrement: e.correct } },
        });
      }
      await prisma.post.deleteMany({ where: { authorId } });
    }
    accountsToSeed.push(account);
  }

  const postRows: { authorId: string; text: string; actualType: "AI"; createdAt: Date }[] = [];
  for (const account of accountsToSeed) {
    const authorId = idByUsername.get(account.username)!;
    for (const text of account.posts) {
      postRows.push({ authorId, text, actualType: "AI", createdAt: seedTimestamp(days) });
    }
  }
  if (postRows.length) {
    await prisma.post.createMany({ data: postRows });
    result.postsCreated = postRows.length;
  }
  log(`Posts: ${result.postsCreated} created (${result.skippedAccounts.length} accounts already had posts)`);

  // 3. Likes between AI accounts so the feed doesn't look dead.
  if (accountsToSeed.length) {
    const aiUserIds = [...idByUsername.values()];
    const newPosts = await prisma.post.findMany({
      where: { authorId: { in: accountsToSeed.map((a) => idByUsername.get(a.username)!) } },
      select: { id: true, authorId: true },
    });
    const likeRows: { userId: string; postId: string; createdAt: Date }[] = [];
    for (const post of newPosts) {
      const candidates = aiUserIds.filter((id) => id !== post.authorId);
      const n = seedLikeCount(candidates.length);
      // partial shuffle
      for (let i = candidates.length - 1; i > 0 && i >= candidates.length - n; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      for (const userId of candidates.slice(candidates.length - n)) {
        likeRows.push({ userId, postId: post.id, createdAt: new Date() });
      }
    }
    if (likeRows.length) {
      await prisma.like.createMany({ data: likeRows, skipDuplicates: true });
      await syncLikeCounts(newPosts.map((p) => p.id));
      result.likesCreated = likeRows.length;
    }
    log(`Likes: ${result.likesCreated} created`);
  }

  return result;
}

/** Recompute likeCount from the Like table for the given posts. */
export async function syncLikeCounts(postIds: string[]): Promise<void> {
  if (postIds.length === 0) return;
  await prisma.$executeRaw`
    UPDATE "Post" p
    SET "likeCount" = COALESCE(c.cnt, 0)
    FROM (
      SELECT ids.id, (SELECT count(*) FROM "Like" l WHERE l."postId" = ids.id) AS cnt
      FROM unnest(${postIds}::text[]) AS ids(id)
    ) c
    WHERE p.id = c.id
  `;
}
