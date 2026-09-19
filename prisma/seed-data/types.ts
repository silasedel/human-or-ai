import type { PersonaInput } from "@/lib/ai/personas";

export interface SeedAccount {
  username: string;
  displayName: string;
  bio: string;
  /** DiceBear style + seed; see src/lib/avatars.ts for the style list. */
  avatar: { style: string; seed: string };
  /** Relative posting frequency used by the generator (1 = average). */
  postingWeight: number;
  persona: PersonaInput;
  /** Hand-written seed posts in this account's voice. */
  posts: string[];
}
