import type { PersonaInput } from "@/lib/ai/personas";
import type { AvatarIconId, AvatarPaletteId } from "@/lib/avatar-icons";

export interface SeedAccount {
  username: string;
  displayName: string;
  bio: string;
  /** Icon avatar; see src/lib/avatar-icons.ts for the icon and palette ids. */
  avatar: { icon: AvatarIconId; palette: AvatarPaletteId; inverted?: boolean };
  /** Relative posting frequency used by the generator (1 = average). */
  postingWeight: number;
  persona: PersonaInput;
  /** Hand-written seed posts in this account's voice. */
  posts: string[];
}
