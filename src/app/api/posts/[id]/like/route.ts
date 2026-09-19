import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin, route } from "@/lib/http";
import { toggleLike } from "@/lib/likes";
import { enforceRateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/posts/:id/like — toggles the like for the logged-in user. */
export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  await enforceRateLimit(`like:${user.id}`, 200, 10 * 60);
  const result = await toggleLike(user.id, id);
  return NextResponse.json(result);
});
