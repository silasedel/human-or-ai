import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { assertSameOrigin, route } from "@/lib/http";

/** POST /api/auth/logout — end the current session. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await destroySession();
  return NextResponse.json({ ok: true });
});
