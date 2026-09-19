import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { assertSameOrigin, readJson, route } from "@/lib/http";
import { seedAiAccounts } from "@/lib/seed";

export const maxDuration = 120;

const schema = z.object({ force: z.boolean().default(false) });

/** POST /api/admin/seed { force? } — load the built-in personas and posts. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { force } = await readJson(req, schema);
  const result = await seedAiAccounts({ force });
  return NextResponse.json(result);
});
