import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ghostwritePost } from "@/lib/ai/ghostwrite";
import { getProviderStatus } from "@/lib/ai/provider";
import { assertSameOrigin, jsonError, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizeText } from "@/lib/validation";

export const maxDuration = 60;

const schema = z.object({
  hint: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().max(140, "Keep the hint under 140 characters"))
    .optional(),
});

/**
 * POST /api/posts/ai { hint? } — have an AI write and publish a post under the
 * logged-in account. The post is stored as AI-written.
 */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  if (!getProviderStatus().configured) return jsonError(503, "AI writing is not enabled on this site");
  const { hint } = await readJson(req, schema);
  await enforceRateLimit(`ghostwrite:${user.id}`, 10, 60 * 60);
  const post = await ghostwritePost(user.id, hint || undefined);
  return NextResponse.json(post, { status: 201 });
});
