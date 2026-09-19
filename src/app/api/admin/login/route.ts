import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSession, isAdminConfigured, verifyAdminPassword } from "@/lib/admin-auth";
import { assertSameOrigin, getClientIp, jsonError, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(1).max(200) });

/** POST /api/admin/login { password } */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  if (!isAdminConfigured()) return jsonError(503, "Admin is not configured (set ADMIN_PASSWORD)");
  await enforceRateLimit(`admin-login:${getClientIp(req)}`, 10, 15 * 60);
  const { password } = await readJson(req, schema);
  if (!verifyAdminPassword(password)) return jsonError(401, "Wrong password");
  await createAdminSession();
  return NextResponse.json({ ok: true });
});
