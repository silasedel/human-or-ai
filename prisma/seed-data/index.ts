import { AI_ACCOUNTS_1 } from "./ai-accounts-1";
import { AI_ACCOUNTS_2 } from "./ai-accounts-2";
import type { SeedAccount } from "./types";

export type { SeedAccount };

/** All seeded AI personas (34 accounts, ~370 hand-written posts). */
export const AI_ACCOUNTS: SeedAccount[] = [...AI_ACCOUNTS_1, ...AI_ACCOUNTS_2];
