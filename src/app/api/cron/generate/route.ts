import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sprinkleAiLikes } from "@/lib/ai/engage";
import { generateAiPosts } from "@/lib/ai/generate";
import { AIConfigError, getProviderStatus } from "@/lib/ai/provider";
import { env } from "@/lib/env";
import { jsonError, route } from "@/lib/http";
import { pruneRateLimits } from "@/lib/rate-limit";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/cron/generate — called by Vercel Cron (see vercel.json) or any
 * scheduler that sends `Authorization: Bearer $CRON_SECRET`. Generates the
 * next day's AI posts (scheduled across the coming 24h so they trickle in)
 * and sprinkles AI likes on recent posts so like counts stay unrevealing.
 */
export const GET = route(async (req) => {
  if (!env.cronSecret) return jsonError(503, "CRON_SECRET is not set");
  if (!authorized(req)) return jsonError(401, "Unauthorized");

  const status = getProviderStatus();
  if (!status.configured) return jsonError(503, `AI provider not configured: ${status.detail}`);

  try {
    const result = await generateAiPosts({
      count: env.aiCronPostCount,
      hoursBack: 0,
      hoursForward: 24,
      postsPerCall: 8,
      concurrency: 3,
    });
    const likes = await sprinkleAiLikes({ sinceHours: 48 });
    pruneRateLimits().catch(() => {});
    return NextResponse.json({ ok: true, created: result.created, calls: result.calls, errors: result.errors, likes });
  } catch (err) {
    if (err instanceof AIConfigError) return jsonError(503, err.message);
    throw err;
  }
});
