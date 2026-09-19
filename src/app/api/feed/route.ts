import { NextResponse } from "next/server";
import { getCurrentUser, getGuestId } from "@/lib/auth";
import { getFeedPage, newFeedSeed } from "@/lib/feed";
import { readQuery, route } from "@/lib/http";
import { feedQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/feed?mode=foryou|latest&seed=...&feedTime=...&cursor=...&limit=20 */
export const GET = route(async (req) => {
  const q = readQuery(req, feedQuerySchema);
  const [user, guestId] = await Promise.all([getCurrentUser(), getGuestId()]);
  const page = await getFeedPage({
    mode: q.mode,
    seed: q.seed ?? newFeedSeed(),
    feedTime: q.feedTime ? new Date(q.feedTime) : new Date(),
    cursor: q.cursor,
    limit: q.limit,
    viewer: { userId: user?.id ?? null, guestId },
  });
  return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
});
