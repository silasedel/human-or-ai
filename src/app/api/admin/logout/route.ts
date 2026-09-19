import { NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/admin-auth";
import { assertSameOrigin, route } from "@/lib/http";

/** POST /api/admin/logout */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await destroyAdminSession();
  return NextResponse.json({ ok: true });
});
