import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin, readJson, route } from "@/lib/http";
import { createPost } from "@/lib/posts";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createPostSchema } from "@/lib/validation";

/** POST /api/posts { text } — create a post as the logged-in user. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { text } = await readJson(req, createPostSchema);
  await enforceRateLimit(`post:${user.id}`, 20, 10 * 60);
  const post = await createPost(user.id, text);
  return NextResponse.json(post, { status: 201 });
});
