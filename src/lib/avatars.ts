import { createAvatar } from "@dicebear/core";
import {
  adventurer,
  avataaars,
  bigSmile,
  croodles,
  funEmoji,
  glass,
  lorelei,
  micah,
  miniavs,
  notionists,
  openPeeps,
  personas,
  shapes,
  thumbs,
} from "@dicebear/collection";
import { prisma } from "@/lib/db";
import { pickRandom } from "@/lib/utils";

/**
 * Generated avatars (DiceBear). Every account — human or AI — gets one of
 * these by default, so an avatar style never gives away who is who.
 * Licenses: notionists / lorelei / open-peeps / thumbs / shapes / glass /
 * croodles / miniavs are CC0; adventurer / micah / big-smile / fun-emoji /
 * personas are CC BY 4.0; avataaars is free for personal & commercial use.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STYLE_MAP: Record<string, any> = {
  notionists,
  lorelei,
  "open-peeps": openPeeps,
  adventurer,
  micah,
  avataaars,
  personas,
  miniavs,
  "big-smile": bigSmile,
  croodles,
  thumbs,
  "fun-emoji": funEmoji,
  shapes,
  glass,
};

/** Styles we hand out at random, weighted toward the "person" looking ones. */
const RANDOM_STYLE_POOL: string[] = [
  "notionists", "notionists", "notionists",
  "lorelei", "lorelei", "lorelei",
  "open-peeps", "open-peeps",
  "adventurer", "adventurer",
  "micah", "micah",
  "avataaars", "avataaars",
  "personas",
  "miniavs",
  "big-smile",
  "croodles",
  "thumbs", "thumbs",
  "fun-emoji",
  "shapes",
  "glass",
];

const BACKGROUNDS = [
  "b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "e0f2e9", "fde68a", "fecaca",
  "bfdbfe", "ddd6fe", "fbcfe8", "a7f3d0", "fed7aa", "e5e7eb", "cffafe",
];

export const AVATAR_STYLE_NAMES = Object.keys(STYLE_MAP);

export function isAvatarStyle(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(STYLE_MAP, name);
}

/** Render an SVG string for a style + seed, or null for an unknown style. */
export function renderGeneratedAvatar(styleName: string, seed: string): string | null {
  const style = STYLE_MAP[styleName];
  if (!style) return null;
  const options: Record<string, unknown> = { seed, size: 160 };
  // Styles that don't draw their own background get a soft solid/gradient one.
  if (!["shapes", "glass", "fun-emoji", "thumbs"].includes(styleName)) {
    options.backgroundColor = BACKGROUNDS;
    options.backgroundType = ["solid", "gradientLinear"];
  }
  return createAvatar(style, options).toString();
}

export function generatedAvatarUrl(styleName: string, seed: string): string {
  return `/api/avatars/gen/${styleName}/${encodeURIComponent(seed)}.svg`;
}

/** A fresh random generated avatar URL (used on signup and "shuffle avatar"). */
export function randomGeneratedAvatarUrl(seedHint = ""): string {
  const style = pickRandom(RANDOM_STYLE_POOL);
  const seed = `${seedHint.replace(/[^a-z0-9_-]/gi, "").slice(0, 20)}-${Math.random().toString(36).slice(2, 9)}`;
  return generatedAvatarUrl(style, seed);
}

// ---------------------------------------------------------------------------
// Uploaded avatars
//
// Uploads are stored in Postgres (Avatar table) so the app deploys with zero
// extra services. To move to S3 / Vercel Blob / Supabase Storage, implement
// this interface and swap the export at the bottom of the file.
// ---------------------------------------------------------------------------

export interface AvatarStorage {
  /** Persist the image and return the public URL to store on the user. */
  save(userId: string, data: Buffer, mimeType: string): Promise<string>;
  load(userId: string): Promise<{ data: Buffer; mimeType: string } | null>;
  remove(userId: string): Promise<void>;
}

class DatabaseAvatarStorage implements AvatarStorage {
  async save(userId: string, data: Buffer, mimeType: string): Promise<string> {
    const bytes = new Uint8Array(data);
    await prisma.avatar.upsert({
      where: { userId },
      create: { userId, data: bytes, mimeType },
      update: { data: bytes, mimeType },
    });
    return `/api/avatars/u/${userId}?v=${Date.now()}`;
  }

  async load(userId: string) {
    const row = await prisma.avatar.findUnique({ where: { userId } });
    if (!row) return null;
    return { data: Buffer.from(row.data), mimeType: row.mimeType };
  }

  async remove(userId: string): Promise<void> {
    await prisma.avatar.deleteMany({ where: { userId } });
  }
}

export const avatarStorage: AvatarStorage = new DatabaseAvatarStorage();

export const MAX_AVATAR_BYTES = 512 * 1024;

/** Sniff the image type from magic bytes. Returns null for anything we don't accept. */
export function detectImageMime(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | "image/gif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  return null;
}
