import { AI_ACCOUNTS_1 } from "./ai-accounts-1";
import { AI_ACCOUNTS_2 } from "./ai-accounts-2";
import { EXTRA_POSTS } from "./extra-posts";
import type { SeedAccount } from "./types";

export type { SeedAccount };

/** All seeded AI personas (34 accounts) with every hand-written post merged in. */
export const AI_ACCOUNTS: SeedAccount[] = [...AI_ACCOUNTS_1, ...AI_ACCOUNTS_2].map((account) => ({
  ...account,
  posts: [...account.posts, ...(EXTRA_POSTS[account.username] ?? [])],
}));

export const SEED_POST_COUNT = AI_ACCOUNTS.reduce((sum, a) => sum + a.posts.length, 0);
