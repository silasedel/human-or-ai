/**
 * Validation for deployment secrets.
 *
 * Anything shipped in .env.example is public, so a deployment that keeps a
 * placeholder is running with a credential the whole internet knows. These
 * checks reject the documented placeholders (and obvious stand-ins) and
 * require enough entropy to be worth calling a secret.
 */

export const MIN_SESSION_SECRET_LENGTH = 32;
export const MIN_ADMIN_PASSWORD_LENGTH = 16;

/**
 * Values that must never be accepted. Includes every placeholder this repo has
 * ever documented plus the usual stand-ins people leave behind.
 */
const PLACEHOLDERS = [
  "change-me",
  "change-me-to-a-long-random-string",
  "changeme",
  "change_me",
  "dev-only-insecure-secret-change-me",
  "your-secret-here",
  "yoursecrethere",
  "secret",
  "supersecret",
  "password",
  "admin",
  "adminpassword",
  "please-change-me",
  "replace-me",
  "todo",
  "example",
  "test",
  "insecure",
  "notsecret",
  "xxxxxxxxxxxxxxxx",
];

/** Lowercase, strip quotes and non-alphanumerics so "Change-Me!" matches "change-me". */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const NORMALIZED_PLACEHOLDERS = new Set(PLACEHOLDERS.map(normalize));

export function isPlaceholderSecret(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized) return true;
  if (NORMALIZED_PLACEHOLDERS.has(normalized)) return true;
  // Catch decorated variants like "change-me-now" or "my-change-me-secret".
  if (normalized.includes("changeme")) return true;
  if (normalized.includes("replaceme")) return true;
  if (normalized.includes("insecure")) return true;
  if (/^(.)\1*$/.test(normalized)) return true; // "aaaaaaaa", "00000000"
  return false;
}

/**
 * Rough entropy estimate in bits: length x log2(alphabet size actually used).
 * Not a password-strength oracle, just enough to reject "adminadminadmin1".
 */
export function entropyBits(value: string): number {
  let alphabet = 0;
  if (/[a-z]/.test(value)) alphabet += 26;
  if (/[A-Z]/.test(value)) alphabet += 26;
  if (/[0-9]/.test(value)) alphabet += 10;
  if (/[^a-zA-Z0-9]/.test(value)) alphabet += 32;
  const distinct = new Set(value).size;
  // Repetition shouldn't count for full value: cap by distinct characters used.
  const effective = Math.min(value.length, distinct * 3);
  return alphabet > 1 ? effective * Math.log2(alphabet) : 0;
}

export interface SecretCheck {
  ok: boolean;
  /** Human-readable reason, present when ok is false. */
  reason?: string;
}

export function checkSessionSecret(value: string | undefined): SecretCheck {
  if (!value) return { ok: false, reason: "SESSION_SECRET is not set" };
  if (isPlaceholderSecret(value)) {
    return { ok: false, reason: "SESSION_SECRET is still the example placeholder" };
  }
  if (value.length < MIN_SESSION_SECRET_LENGTH) {
    return {
      ok: false,
      reason: `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters (use: openssl rand -hex 32)`,
    };
  }
  if (entropyBits(value) < 80) {
    return { ok: false, reason: "SESSION_SECRET is not random enough (use: openssl rand -hex 32)" };
  }
  return { ok: true };
}

export function checkAdminPassword(value: string | undefined): SecretCheck {
  if (!value) return { ok: false, reason: "ADMIN_PASSWORD is not set, so the admin area is disabled" };
  if (isPlaceholderSecret(value)) {
    return { ok: false, reason: "ADMIN_PASSWORD is still the example placeholder, so the admin area is disabled" };
  }
  if (value.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters (use: openssl rand -base64 24)`,
    };
  }
  if (entropyBits(value) < 60) {
    return { ok: false, reason: "ADMIN_PASSWORD is too predictable (use: openssl rand -base64 24)" };
  }
  return { ok: true };
}
