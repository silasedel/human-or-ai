import { z } from "zod";
import { parseAvatar } from "@/lib/avatar-icons";

export const POST_MAX_LENGTH = 500;
export const BIO_MAX_LENGTH = 160;
export const DISPLAY_NAME_MAX_LENGTH = 40;
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Handles that would collide with routes or be misleading. */
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "mod", "moderator", "support",
  "api", "login", "signup", "logout", "settings", "score", "about", "u",
  "post", "posts", "feed", "home", "human", "ai", "null", "undefined", "me",
]);

// Control characters (except tab / newline), built without literal escapes.
const CONTROL_CHARS = new RegExp(
  "[" +
    String.fromCharCode(0) + "-" + String.fromCharCode(8) +
    String.fromCharCode(11) + String.fromCharCode(12) +
    String.fromCharCode(14) + "-" + String.fromCharCode(31) +
    String.fromCharCode(127) +
    "]",
  "g",
);

/** Strip control characters (keep newlines/tabs), collapse excessive blank lines, trim. */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, "Username must be 3-20 characters using only letters, numbers and underscores")
  .refine((u) => !RESERVED_USERNAMES.has(u), "That username is reserved");

export const displayNameSchema = z
  .string()
  .transform(normalizeText)
  .pipe(
    z
      .string()
      .min(1, "Display name is required")
      .max(DISPLAY_NAME_MAX_LENGTH, `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`)
      .refine((s) => !s.includes("\n"), "Display name cannot contain line breaks"),
  );

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

export const bioSchema = z
  .string()
  .transform(normalizeText)
  .pipe(z.string().max(BIO_MAX_LENGTH, `Bio must be at most ${BIO_MAX_LENGTH} characters`));

export const postTextSchema = z
  .string()
  .transform(normalizeText)
  .pipe(
    z
      .string()
      .min(1, "Post cannot be empty")
      .max(POST_MAX_LENGTH, `Post must be at most ${POST_MAX_LENGTH} characters`),
  );

/** Avatar codes look like "icon:star:sky:0" (see src/lib/avatar-icons.ts). */
export const avatarCodeSchema = z
  .string()
  .trim()
  .max(60)
  .refine((s) => parseAvatar(s) !== null, "Pick a valid avatar icon and color");

export const signupSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  pin: pinSchema,
});

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Username is required").max(50),
  pin: pinSchema,
});

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  bio: bioSchema,
  profileImage: avatarCodeSchema.optional(),
});

export const changePinSchema = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
});

export const createPostSchema = z.object({
  text: postTextSchema,
});

export const guessSchema = z.object({
  guess: z.enum(["HUMAN", "AI"]),
});

export const feedQuerySchema = z.object({
  mode: z.enum(["foryou", "latest"]).default("foryou"),
  seed: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  feedTime: z.coerce.number().int().positive().optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const profilePostsQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
