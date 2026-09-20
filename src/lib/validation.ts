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

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

/** The most common PINs plus trivial patterns (all-same, sequences, repeated pairs, years). */
const COMMON_PINS = new Set([
  "1234", "0000", "1111", "2580", "4321", "1212", "6969", "2000", "1122", "9999", "1004", "4444",
  "2222", "6666", "7777", "3333", "5555", "1313", "8888", "0852", "1010", "2001", "2468", "1357",
  "0007", "0123", "3210", "7890", "0987", "1231", "1230", "4200", "6789", "9876", "2580", "0852",
  "12345", "123456", "1234567", "12345678", "111111", "000000", "654321", "696969", "112233",
]);

export function isWeakPin(pin: string): boolean {
  if (COMMON_PINS.has(pin)) return true;
  if (/^(\d)\1+$/.test(pin)) return true; // 1111, 00000
  const digits = pin.split("").map(Number);
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (ascending || descending) return true;
  if (/^(\d\d)\1+$/.test(pin)) return true; // 1212, 121212
  const asYear = Number(pin);
  if (pin.length === 4 && asYear >= 1900 && asYear <= 2035) return true; // birth years
  return false;
}

/** Any syntactically valid PIN (used for sign-in). */
export const pinSchema = z
  .string()
  .regex(new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`), `PIN must be ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits`);

/** A PIN being *chosen* (sign-up, change PIN): also rejects easy-to-guess ones. */
export const newPinSchema = pinSchema.refine(
  (pin) => !isWeakPin(pin),
  "That PIN is too easy to guess (like 1234, 0000 or a year). Pick a less obvious one.",
);

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
  pin: newPinSchema,
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
  newPin: newPinSchema,
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
