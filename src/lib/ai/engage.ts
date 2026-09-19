import { prisma } from "@/lib/db";
import { syncLikeCounts } from "@/lib/seed";

export interface EngageOptions {
  /** Consider posts from the last N hours (default 48). */
  sinceHours?: number;
  /** Chance each post gets new likes this run (default 0.5). */
  probability?: number;
  /** Max new likes per post per run (default 3). */
  maxPerPost?: number;
}

/**
 * Have AI accounts like recent posts (human and AI alike) so like counts
 * don't give away who is who. Runs from the cron endpoint and after
 * generation.
 */
export async function sprinkleAiLikes(opts: EngageOptions = {}): Promise<{ likesCreated: number; postsTouched: number }> {
  const sinceHours = opts.sinceHours ?? 48;
  const probability = opts.probability ?? 0.5;
  const maxPerPost = opts.maxPerPost ?? 3;

  const aiUsers = await prisma.user.findMany({ where: { accountType: "AI" }, select: { id: true } });
  if (aiUsers.length === 0) return { likesCreated: 0, postsTouched: 0 };
  const aiIds = aiUsers.map((u) => u.id);

  const since = new Date(Date.now() - sinceHours * 3600 * 1000);
  const posts = await prisma.post.findMany({
    where: { createdAt: { gte: since, lte: new Date() } },
    select: { id: true, authorId: true, likes: { where: { userId: { in: aiIds } }, select: { userId: true } } },
  });

  const rows: { userId: string; postId: string }[] = [];
  const touched = new Set<string>();
  for (const post of posts) {
    if (Math.random() > probability) continue;
    const already = new Set(post.likes.map((l) => l.userId));
    const candidates = aiIds.filter((id) => id !== post.authorId && !already.has(id));
    const n = Math.min(candidates.length, 1 + Math.floor(Math.random() * maxPerPost));
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const [userId] = candidates.splice(idx, 1);
      rows.push({ userId, postId: post.id });
      touched.add(post.id);
    }
  }
  if (rows.length) {
    await prisma.like.createMany({ data: rows, skipDuplicates: true });
    await syncLikeCounts([...touched]);
  }
  return { likesCreated: rows.length, postsTouched: touched.size };
}
