import { Prisma, type AuthorType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";

export type FeedMode = "foryou" | "latest";

export interface PostAuthorDTO {
  id: string;
  username: string;
  displayName: string;
  profileImage: string | null;
}

/** Only present once the viewer has guessed — this is the only place the truth leaks to the client. */
export interface GuessRevealDTO {
  guessedType: AuthorType;
  correct: boolean;
  actualType: AuthorType;
  humanPct: number;
  aiPct: number;
  totalGuesses: number;
}

export interface PostDTO {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  /** The viewer wrote this post (no guessing on your own posts). */
  isOwn: boolean;
  author: PostAuthorDTO;
  guess: GuessRevealDTO | null;
}

export interface Viewer {
  userId: string | null;
  guestId: string | null;
}

export interface FeedPage {
  posts: PostDTO[];
  nextCursor: string | null;
}

export const postSelect = {
  id: true,
  text: true,
  createdAt: true,
  likeCount: true,
  humanGuessCount: true,
  aiGuessCount: true,
  actualType: true,
  authorId: true,
  author: { select: { id: true, username: true, displayName: true, profileImage: true } },
} satisfies Prisma.PostSelect;

export type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

/** How far back (hours) recency still nudges a post upward in the shuffled feed. */
const RECENCY_HORIZON_HOURS = 336; // 14 days
const RANDOM_WEIGHT = 0.6;
const RECENCY_WEIGHT = 0.4;

export function guessPercentages(humanGuessCount: number, aiGuessCount: number) {
  const total = humanGuessCount + aiGuessCount;
  if (total === 0) return { humanPct: 0, aiPct: 0, totalGuesses: 0 };
  const humanPct = Math.round((humanGuessCount / total) * 100);
  return { humanPct, aiPct: 100 - humanPct, totalGuesses: total };
}

/** Attach viewer-specific state (their guess, their like) and strip the secret. */
export async function hydratePosts(rows: PostRow[], viewer: Viewer): Promise<PostDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const guessWhere = viewer.userId
    ? { userId: viewer.userId, postId: { in: ids } }
    : viewer.guestId
      ? { guestId: viewer.guestId, postId: { in: ids } }
      : null;

  const [guesses, likes] = await Promise.all([
    guessWhere
      ? prisma.guess.findMany({ where: guessWhere, select: { postId: true, guessedType: true, correct: true } })
      : Promise.resolve([]),
    viewer.userId
      ? prisma.like.findMany({ where: { userId: viewer.userId, postId: { in: ids } }, select: { postId: true } })
      : Promise.resolve([]),
  ]);

  const guessByPost = new Map(guesses.map((g) => [g.postId, g]));
  const likedSet = new Set(likes.map((l) => l.postId));

  return rows.map((row) => {
    const g = guessByPost.get(row.id);
    return {
      id: row.id,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      likeCount: row.likeCount,
      liked: likedSet.has(row.id),
      isOwn: viewer.userId !== null && row.authorId === viewer.userId,
      author: row.author,
      guess: g
        ? {
            guessedType: g.guessedType,
            correct: g.correct,
            actualType: row.actualType,
            ...guessPercentages(row.humanGuessCount, row.aiGuessCount),
          }
        : null,
    };
  });
}

// --- Cursors -------------------------------------------------------------

function encodeCursor(parts: string[]): string {
  return Buffer.from(parts.join("|")).toString("base64url");
}

function decodeCursor(cursor: string | undefined, expectedParts: number): string[] | null {
  if (!cursor) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new HttpError(400, "Invalid cursor");
  }
  const parts = decoded.split("|");
  if (parts.length !== expectedParts) throw new HttpError(400, "Invalid cursor");
  return parts;
}

const ID_RE = /^[a-z0-9]{10,40}$/;

// --- Feed queries --------------------------------------------------------

interface FeedArgs {
  mode: FeedMode;
  /** Per-visitor shuffle seed (foryou mode). */
  seed: string;
  /** Fixed reference time so ranks stay stable while paginating (foryou mode). */
  feedTime: Date;
  cursor?: string;
  limit: number;
  viewer: Viewer;
}

/**
 * "For you": every visitor gets their own stable shuffle of the whole feed
 * (seeded hash of post id + seed), gently biased toward newer posts so the
 * feed still feels alive. "Latest": plain reverse chronological.
 */
export async function getFeedPage(args: FeedArgs): Promise<FeedPage> {
  const { mode, seed, feedTime, cursor, limit, viewer } = args;

  if (mode === "latest") {
    const parts = decodeCursor(cursor, 2);
    let cursorWhere: Prisma.PostWhereInput = {};
    if (parts) {
      const [ts, id] = parts;
      const date = new Date(ts);
      if (Number.isNaN(date.getTime()) || !ID_RE.test(id)) throw new HttpError(400, "Invalid cursor");
      cursorWhere = { OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: id } }] };
    }
    const rows = await prisma.post.findMany({
      where: { AND: [{ createdAt: { lte: new Date() } }, cursorWhere] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: postSelect,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      posts: await hydratePosts(page, viewer),
      nextCursor: hasMore && last ? encodeCursor([last.createdAt.toISOString(), last.id]) : null,
    };
  }

  // --- "for you" (seeded shuffle with recency bias) ---
  const parts = decodeCursor(cursor, 2);
  let cursorClause = Prisma.empty;
  if (parts) {
    const rank = Number(parts[0]);
    const id = parts[1];
    if (!Number.isFinite(rank) || !ID_RE.test(id)) throw new HttpError(400, "Invalid cursor");
    cursorClause = Prisma.sql`WHERE (rank, id) > (${rank}::float8, ${id}::text)`;
  }

  const ranked = await prisma.$queryRaw<{ id: string; rank: number }[]>(Prisma.sql`
    SELECT id, rank FROM (
      SELECT
        p.id,
        (
          ${RANDOM_WEIGHT} * ((('x' || substr(md5(p.id || ${seed}::text), 1, 8))::bit(32)::bigint)::float8 / 4294967295.0)
          + ${RECENCY_WEIGHT} * (
              GREATEST(0.0, LEAST(
                EXTRACT(EPOCH FROM (${feedTime}::timestamptz - p."createdAt")) / 3600.0,
                ${RECENCY_HORIZON_HOURS}::float8
              )) / ${RECENCY_HORIZON_HOURS}::float8
            )
        )::float8 AS rank
      FROM "Post" p
      WHERE p."createdAt" <= now()
    ) ranked
    ${cursorClause}
    ORDER BY rank ASC, id ASC
    LIMIT ${limit + 1}
  `);

  const hasMore = ranked.length > limit;
  const page = hasMore ? ranked.slice(0, limit) : ranked;
  const ids = page.map((r) => r.id);
  const rows = await prisma.post.findMany({ where: { id: { in: ids } }, select: postSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is PostRow => Boolean(r));
  const last = page[page.length - 1];

  return {
    posts: await hydratePosts(ordered, viewer),
    nextCursor: hasMore && last ? encodeCursor([String(last.rank), last.id]) : null,
  };
}

/** A user's posts, newest first, with cursor pagination. */
export async function getProfilePosts(args: {
  authorId: string;
  cursor?: string;
  limit: number;
  viewer: Viewer;
}): Promise<FeedPage> {
  const { authorId, cursor, limit, viewer } = args;
  const parts = decodeCursor(cursor, 2);
  let cursorWhere: Prisma.PostWhereInput = {};
  if (parts) {
    const [ts, id] = parts;
    const date = new Date(ts);
    if (Number.isNaN(date.getTime()) || !ID_RE.test(id)) throw new HttpError(400, "Invalid cursor");
    cursorWhere = { OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: id } }] };
  }
  const rows = await prisma.post.findMany({
    where: { AND: [{ authorId }, { createdAt: { lte: new Date() } }, cursorWhere] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: postSelect,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    posts: await hydratePosts(page, viewer),
    nextCursor: hasMore && last ? encodeCursor([last.createdAt.toISOString(), last.id]) : null,
  };
}

export async function getPostById(id: string, viewer: Viewer): Promise<PostDTO | null> {
  if (!ID_RE.test(id)) return null;
  const row = await prisma.post.findFirst({ where: { id, createdAt: { lte: new Date() } }, select: postSelect });
  if (!row) return null;
  const [dto] = await hydratePosts([row], viewer);
  return dto;
}

/** Generate a URL-safe random feed seed. */
export function newFeedSeed(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}
