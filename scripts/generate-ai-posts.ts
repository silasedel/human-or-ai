/**
 * Generate a batch of AI posts and store them in the database.
 *
 *   npm run generate-ai-posts                     # 100 posts spread over the past 3 days
 *   npm run generate-ai-posts -- --count 40
 *   npm run generate-ai-posts -- --count 24 --hours-back 0 --hours-forward 24   # schedule the next day
 *   npm run generate-ai-posts -- --user jordan_txt --count 10
 *   npm run generate-ai-posts -- --dry-run         # print, don't save
 *   npm run generate-ai-posts -- --likes           # also sprinkle AI likes on recent posts
 *
 * Requires AI_PROVIDER + credentials in .env (see .env.example).
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { generateAiPosts } from "../src/lib/ai/generate";
import { sprinkleAiLikes } from "../src/lib/ai/engage";
import { getProviderStatus } from "../src/lib/ai/provider";

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function readNumber(name: string, fallback: number): number {
  const raw = readArg(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number`);
  return n;
}

async function main() {
  const count = readNumber("count", 100);
  const hoursBack = readNumber("hours-back", 72);
  const hoursForward = readNumber("hours-forward", 0);
  const postsPerCall = readNumber("per-call", 8);
  const concurrency = readNumber("concurrency", 3);
  const dryRun = process.argv.includes("--dry-run");
  const likes = process.argv.includes("--likes");
  const username = readArg("user");

  const status = getProviderStatus();
  console.log(`Provider: ${status.provider} / ${status.model} — ${status.detail}`);
  if (!status.configured) {
    console.error("AI provider is not configured. Add credentials to .env (see .env.example).");
    process.exitCode = 1;
    return;
  }

  let userIds: string[] | undefined;
  if (username) {
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() }, select: { id: true, accountType: true } });
    if (!user || user.accountType !== "AI") throw new Error(`No AI account named @${username}`);
    userIds = [user.id];
  }

  const result = await generateAiPosts({
    count,
    hoursBack,
    hoursForward,
    postsPerCall,
    concurrency,
    dryRun,
    userIds,
    log: (m) => console.log(m),
  });

  console.log("");
  console.log(`Created ${result.created}/${result.requested} posts in ${result.calls} calls (${result.failedCalls} failed, ${result.discarded} discarded)${dryRun ? " [dry run]" : ""}`);
  if (result.errors.length) {
    console.log("Errors:");
    for (const e of result.errors) console.log("  - " + e);
  }
  if (dryRun) {
    console.log("\nSamples:");
    for (const s of result.samples) console.log(`  @${s.username}: ${s.text}`);
  }

  if (likes && !dryRun) {
    const liked = await sprinkleAiLikes({ sinceHours: Math.max(hoursBack, 24) });
    console.log(`Sprinkled ${liked.likesCreated} AI likes on ${liked.postsTouched} recent posts`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
