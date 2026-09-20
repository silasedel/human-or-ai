import { NextResponse } from "next/server";
import { ensureGuestId, getCurrentUser } from "@/lib/auth";
import { submitGuess } from "@/lib/guesses";
import { assertSameOrigin, getClientIp, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { guessSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/posts/:id/guess { guess: "HUMAN" | "AI" }
 * Works for logged-in users and for guests (tracked with a cookie). The true
 * author type is only ever returned in this response, after the guess is locked.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { guess } = await readJson(req, guessSchema);
  const user = await getCurrentUser();
  const guestId = user ? null : await ensureGuestId();

  // Per-viewer key: account id, else the guest cookie, else a trusted IP.
  // Never a spoofable header, and never one bucket shared by every visitor.
  const ip = getClientIp(req);
  const limitKey = user ? `u:${user.id}` : guestId ? `g:${guestId}` : ip ? `ip:${ip}` : null;
  if (limitKey) await enforceRateLimit(`guess:${limitKey}`, 300, 10 * 60);

  const result = await submitGuess({ postId: id, guess, userId: user?.id ?? null, guestId });
  return NextResponse.json(result, { status: result.alreadyGuessed ? 200 : 201 });
});
