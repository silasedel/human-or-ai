/**
 * Database seed: creates the AI personas and their hand-written posts.
 *
 *   npm run db:seed            # create accounts + posts (skips accounts that already have posts)
 *   npm run db:seed -- --force # wipe seeded AI posts and re-create them
 *   npm run db:seed -- --days 30
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { seedAiAccounts } from "../src/lib/seed";

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const force = process.argv.includes("--force");
  const days = Number(readArg("days") ?? 14);
  console.log(`Seeding AI accounts and posts${force ? " (force)" : ""}...`);
  const result = await seedAiAccounts({ force, days: Number.isFinite(days) ? days : 14, log: (m) => console.log(m) });
  console.log("Done:", result);
  if (result.skippedAccounts.length && !force) {
    console.log("Accounts that already had posts were skipped. Use --force to re-seed their posts.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
