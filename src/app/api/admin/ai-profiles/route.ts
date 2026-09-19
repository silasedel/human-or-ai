import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { personaSchema } from "@/lib/ai/personas";
import { randomAvatarCode } from "@/lib/avatar-icons";
import { prisma } from "@/lib/db";
import { assertSameOrigin, jsonError, readJson, route } from "@/lib/http";
import { bioSchema, displayNameSchema, usernameSchema } from "@/lib/validation";

const schema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  bio: bioSchema.default(""),
  postingWeight: z.number().min(0.1).max(5).default(1),
  persona: personaSchema,
});

/** POST /api/admin/ai-profiles — create an AI-controlled account with a persona. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const data = await readJson(req, schema);
  try {
    const user = await prisma.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        bio: data.bio,
        accountType: "AI",
        pinHash: null,
        persona: data.persona,
        postingWeight: data.postingWeight,
        profileImage: randomAvatarCode(),
      },
      select: { id: true, username: true },
    });
    return NextResponse.json({ ok: true, ...user }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(409, "That username is taken");
    }
    throw err;
  }
});
