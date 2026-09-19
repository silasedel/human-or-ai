import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

export const SESSION_COOKIE = "hoa_session";
export const GUEST_COOKIE = "hoa_guest";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // extend when < 15 days left
const GUEST_TTL_SECONDS = 60 * 60 * 24 * 365;

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  profileImage: string | null;
  accountType: "HUMAN" | "AI";
  guessCount: number;
  correctCount: number;
  createdAt: Date;
};

export const currentUserSelect = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  profileImage: true,
  accountType: true,
  guessCount: true,
  correctCount: true,
  createdAt: true,
} as const;

// --- PIN hashing --------------------------------------------------------

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, pinHash: string | null): Promise<boolean> {
  if (!pinHash) return false;
  return bcrypt.compare(pin, pinHash);
}

// --- Sessions -----------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProduction,
    path: "/",
    maxAge,
  };
}

/** Create a session row and set the session cookie. Call from a route handler or server action. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS));
}

/** Delete the current session (if any) and clear the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.set(SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

/** Invalidate every session for a user (used when the PIN changes / account deleted). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Resolve the logged-in user from the session cookie. Cached per request so
 * layouts, pages and components can all call it freely.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: currentUserSelect } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.expiresAt.getTime() - Date.now() < SESSION_REFRESH_THRESHOLD_MS) {
    // Sliding expiry: quietly extend active sessions.
    prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) },
      })
      .catch(() => {});
  }
  return session.user;
});

/** Like getCurrentUser but throws a 401 HttpError for API routes. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "You need to sign in to do that");
  return user;
}

// --- Guest identity -----------------------------------------------------

const GUEST_ID_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** Read the anonymous guest id cookie (if present and well-formed). */
export async function getGuestId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(GUEST_COOKIE)?.value;
  return value && GUEST_ID_RE.test(value) ? value : null;
}

/** Get or create the guest id. Only call from route handlers / server actions. */
export async function ensureGuestId(): Promise<string> {
  const existing = await getGuestId();
  if (existing) return existing;
  const id = randomBytes(24).toString("base64url");
  const store = await cookies();
  store.set(GUEST_COOKIE, id, cookieOptions(GUEST_TTL_SECONDS));
  return id;
}

/**
 * When a guest signs up or logs in, carry their anonymous guesses over to the
 * account (skipping posts the account already guessed) and recompute stats.
 */
export async function migrateGuestGuesses(guestId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const guestGuesses = await tx.guess.findMany({
      where: { guestId },
      select: { id: true, postId: true },
    });
    if (guestGuesses.length === 0) return;

    const already = await tx.guess.findMany({ where: { userId }, select: { postId: true } });
    const alreadySet = new Set(already.map((g) => g.postId));
    const movable = guestGuesses.filter((g) => !alreadySet.has(g.postId)).map((g) => g.id);
    const duplicates = guestGuesses.filter((g) => alreadySet.has(g.postId)).map((g) => g.id);

    if (movable.length) {
      await tx.guess.updateMany({ where: { id: { in: movable } }, data: { userId, guestId: null } });
    }
    if (duplicates.length) {
      await tx.guess.deleteMany({ where: { id: { in: duplicates } } });
    }
    if (movable.length) {
      const [guessCount, correctCount] = await Promise.all([
        tx.guess.count({ where: { userId } }),
        tx.guess.count({ where: { userId, correct: true } }),
      ]);
      await tx.user.update({ where: { id: userId }, data: { guessCount, correctCount } });
    }
  });
}
