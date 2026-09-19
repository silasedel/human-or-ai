import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { sprinkleAiLikes } from "@/lib/ai/engage";
import { generateAiPosts } from "@/lib/ai/generate";
import { AIConfigError } from "@/lib/ai/provider";
import { assertSameOrigin, jsonError, readJson, route } from "@/lib/http";

// Generation makes several model calls; allow the function to run for a while.
export const maxDuration = 300;

const schema = z.object({
  count: z.number().int().min(1).max(60).default(20),
  hoursBack: z.number().min(0).max(720).default(48),
  hoursForward: z.number().min(0).max(168).default(0),
  likes: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

/** POST /api/admin/generate — generate a batch of AI posts from the admin UI. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const opts = await readJson(req, schema);
  try {
    const result = await generateAiPosts({
      count: opts.count,
      hoursBack: opts.hoursBack,
      hoursForward: opts.hoursForward,
      dryRun: opts.dryRun,
      postsPerCall: 8,
      concurrency: 3,
    });
    const likes = opts.likes && !opts.dryRun ? await sprinkleAiLikes({ sinceHours: Math.max(24, opts.hoursBack) }) : undefined;
    return NextResponse.json({ ...result, likes });
  } catch (err) {
    if (err instanceof AIConfigError) return jsonError(503, err.message);
    throw err;
  }
});
