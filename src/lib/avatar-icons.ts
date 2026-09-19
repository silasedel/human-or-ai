/**
 * Icon avatars. Every account, human or AI, picks one icon and one two-color
 * palette (optionally swapped). Nobody can upload a photo, so avatars never
 * reveal who is a person and who is a machine.
 *
 * Stored on User.profileImage as a compact code: "icon:<icon>:<palette>:<0|1>".
 * This file is framework-free so it can be used on the server and the client;
 * the actual glyphs are mapped to lucide icons in src/components/Avatar.tsx.
 */

export const AVATAR_ICON_IDS = [
  "star", "zap", "heart", "leaf", "moon", "sun", "cloud", "droplet", "flame", "gem",
  "ghost", "cat", "dog", "bird", "fish", "rabbit", "turtle", "rocket", "music", "headphones",
  "guitar", "coffee", "pizza", "cookie", "cherry", "smile", "eye", "lightbulb", "umbrella", "anchor",
  "gamepad", "bike", "camera", "flower", "mountain", "snowflake", "skull", "crown", "trophy", "dices",
  "plane", "sailboat",
] as const;

export type AvatarIconId = (typeof AVATAR_ICON_IDS)[number];

export interface AvatarPalette {
  /** Background color. */
  bg: string;
  /** Icon color. */
  fg: string;
  label: string;
}

export const AVATAR_PALETTES = {
  sky: { bg: "#1d9bf0", fg: "#ffffff", label: "Sky" },
  coral: { bg: "#ff6b57", fg: "#fff4ee", label: "Coral" },
  mint: { bg: "#34d399", fg: "#064e3b", label: "Mint" },
  lemon: { bg: "#fde047", fg: "#713f12", label: "Lemon" },
  lilac: { bg: "#c4b5fd", fg: "#4c1d95", label: "Lilac" },
  rose: { bg: "#f9a8d4", fg: "#831843", label: "Rose" },
  ink: { bg: "#111827", fg: "#f9fafb", label: "Ink" },
  sand: { bg: "#fcd9a6", fg: "#7c2d12", label: "Sand" },
  teal: { bg: "#0d9488", fg: "#ccfbf1", label: "Teal" },
  navy: { bg: "#1e3a8a", fg: "#93c5fd", label: "Navy" },
  lime: { bg: "#a3e635", fg: "#365314", label: "Lime" },
  slate: { bg: "#94a3b8", fg: "#0f172a", label: "Slate" },
  tangerine: { bg: "#fb923c", fg: "#431407", label: "Tangerine" },
  cherry: { bg: "#dc2626", fg: "#fee2e2", label: "Cherry" },
} as const satisfies Record<string, AvatarPalette>;

export type AvatarPaletteId = keyof typeof AVATAR_PALETTES;
export const AVATAR_PALETTE_IDS = Object.keys(AVATAR_PALETTES) as AvatarPaletteId[];

export interface AvatarSpec {
  icon: AvatarIconId;
  palette: AvatarPaletteId;
  /** Swap background and icon colors. */
  inverted: boolean;
}

const ICON_SET = new Set<string>(AVATAR_ICON_IDS);

export function isAvatarIconId(value: string): value is AvatarIconId {
  return ICON_SET.has(value);
}

export function isAvatarPaletteId(value: string): value is AvatarPaletteId {
  return Object.prototype.hasOwnProperty.call(AVATAR_PALETTES, value);
}

export function encodeAvatar(spec: AvatarSpec): string {
  return `icon:${spec.icon}:${spec.palette}:${spec.inverted ? 1 : 0}`;
}

/** Parse a stored code. Returns null for anything that isn't a valid icon avatar. */
export function parseAvatar(value: string | null | undefined): AvatarSpec | null {
  if (!value || !value.startsWith("icon:")) return null;
  const parts = value.split(":");
  if (parts.length !== 4) return null;
  const [, icon, palette, inv] = parts;
  if (!isAvatarIconId(icon) || !isAvatarPaletteId(palette)) return null;
  if (inv !== "0" && inv !== "1") return null;
  return { icon, palette, inverted: inv === "1" };
}

export function avatarColors(spec: AvatarSpec): { bg: string; fg: string } {
  const p = AVATAR_PALETTES[spec.palette];
  return spec.inverted ? { bg: p.fg, fg: p.bg } : { bg: p.bg, fg: p.fg };
}

function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic avatar for accounts that somehow have none (never blank). */
export function fallbackAvatar(seed: string): AvatarSpec {
  const h = hashString(seed || "?");
  return {
    icon: AVATAR_ICON_IDS[h % AVATAR_ICON_IDS.length],
    palette: AVATAR_PALETTE_IDS[(h >>> 8) % AVATAR_PALETTE_IDS.length],
    inverted: ((h >>> 16) & 1) === 1,
  };
}

/** A random avatar for new accounts. */
export function randomAvatar(): AvatarSpec {
  return {
    icon: AVATAR_ICON_IDS[Math.floor(Math.random() * AVATAR_ICON_IDS.length)],
    palette: AVATAR_PALETTE_IDS[Math.floor(Math.random() * AVATAR_PALETTE_IDS.length)],
    inverted: Math.random() < 0.3,
  };
}

export function randomAvatarCode(): string {
  return encodeAvatar(randomAvatar());
}
