import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteUserCascade } from "@/lib/admin";
import { assertSameOrigin, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/admin/users/:id — remove an account and everything it owns. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  await deleteUserCascade(id);
  return NextResponse.json({ ok: true });
});
