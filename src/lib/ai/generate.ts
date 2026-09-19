import { prisma } from "@/lib/db";
import { shuffle } from "@/lib/utils";
import { AIConfigError, getTextProvider, type TextProvider } from "./provider";
import { DEFAULT_PERSONA, describePersona, lengthPlan, parsePersona, type Persona } from "./personas";
import { cleanGeneratedPost, dedupeKey, dedupePrefix, parsePostArray } from "./filters";

export interface GenerateOptions {
  /** Total number of posts to create across all AI accounts. */
  count: number;
  /** Spread createdAt randomly over the past N hours (default 72). */
  hoursBack?: number;
  /** Schedule some posts into the future: spread over the next N hours (default 0). */
  hoursForward?: number;
  /** Restrict generation to these AI account ids. */
  userIds?: string[];
  /** Posts requested per model call (default 8). */
  postsPerCall?: number;
  /** Parallel model calls (default 2). */
  concurrency?: number;
  /** Generate and report, but do not write to the database. */
  dryRun?: boolean;
  provider?: TextProvider;
  log?: (message: string) => void;
}

export interface GeneratedSample {
  username: string;
  text: string;
  createdAt: string;
}

export interface GenerateResult {
  requested: number;
  created: number;
  discarded: number;
  calls: number;
  failedCalls: number;
  errors: string[];
  perUser: Record<string, number>;
  samples: GeneratedSample[];
  provider: string;
  model: string;
  dryRun: boolean;
}

/**
 * The system prompt is where the realism lives. It is deliberately blunt
 * about what "sounds like a bot" so the model stays boring and specific.
 */
export const SYSTEM_PROMPT = `You write posts for one fictional account on a small, text-only social network (think a stripped-down X/Twitter). Your job is to imitate exactly how a specific real person actually posts: quick, casual, unpolished, specific, often about nothing. These posts get mixed into a feed with real people's posts and readers try to spot the machine-written ones. Your posts must be indistinguishable from the real ones.

What real posts look like:
- Written on a phone in ten seconds. No polish, no structure, no build-up, no payoff.
- Mostly about nothing: being tired, food, a show, a game, weather, work or school, an errand, a small win, a mild complaint, a dumb thought, something a roommate/coworker/dog did.
- Concrete and specific: a brand, a number, a time, a particular thing that happened today. Not general, not reflective, not "observational comedy".
- Length varies a LOT. Many are 2-6 words. Many are one sentence. Some are two or three sentences. A few are a short paragraph. Follow the length plan you are given.
- Different posts start differently. Do not begin several posts with "just", "why", "me when", "the fact that", or "okay".
- Statements, not questions, unless the persona is a question-asker. No rhetorical questions.
- No moral, no lesson, no tidy ending, no "anyway". Real posts just stop.
- Mildly negative or neutral more often than upbeat. Nobody is inspiring anybody.

Never do any of this (these are dead giveaways):
- These phrases or anything like them: "there's something about", "am I the only one", "it's fascinating how", "in today's world", "honestly, I've been thinking", "let that sink in", "in a world where", "it's wild/crazy how", "the little things", "hits different", "core memory", "big mood", "plot twist", "unpopular opinion", "hot take", "shoutout to", "friendly reminder", "delve", "tapestry", "testament".
- Em dashes, semicolons, bullet points, numbered lists, hashtags (at most one hashtag per 30 posts), quotation marks around the whole post, emojis at the start of a post.
- Neat parallel structure, clever wordplay, alliteration, "profound" observations about life, gratitude posts, motivational anything.
- Explaining the joke, adding context a real poster wouldn't bother with, or writing like a brand.
- Mentioning AI, bots, language models, algorithms, or this game. Never write @usernames. Never name real celebrities, politicians, or companies' employees; generic references ("my manager", "my roommate", "my sister") are fine. Keep it PG-13, no slurs, nothing hateful.
- Repeating a topic from the example posts or the avoid list. Every post in a batch should be about a different thing.

Output format: a JSON array of strings and nothing else. No markdown code fences, no commentary, no numbering.`;

function seasonContext(now: Date): string {
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();
  const m = now.getMonth();
  const season = m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "fall";
  return `It is ${month} ${year} (${season} in the northern hemisphere). Let that quietly inform what they'd be doing (weather, school/work rhythm, what's in season) but never state the date.`;
}

function buildUserPrompt(args: {
  persona: Persona;
  displayName: string;
  bio: string;
  examples: string[];
  avoid: string[];
  n: number;
}): string {
  const { persona, displayName, bio, examples, avoid, n } = args;
  const parts: string[] = [];
  parts.push("PERSONA\n" + describePersona(persona, displayName, bio));
  if (examples.length) {
    parts.push(
      "EARLIER POSTS FROM THIS ACCOUNT (match the voice exactly; do not reuse these topics):\n" +
        examples.map((e) => `- ${e.replace(/\n/g, " ")}`).join("\n"),
    );
  }
  if (avoid.length) {
    parts.push(
      "RECENTLY POSTED ON THE SITE BY OTHERS (do not post about the same things):\n" +
        avoid.map((e) => `- ${e.replace(/\n/g, " ").slice(0, 80)}`).join("\n"),
    );
  }
  parts.push("CONTEXT\n" + seasonContext(new Date()));
  parts.push(
    `TASK\nWrite ${n} new posts from this account. Length plan for this batch: ${lengthPlan(persona, n)}. ` +
      `Shuffle the order so lengths are mixed. Return only a JSON array of ${n} strings.`,
  );
  return parts.join("\n\n");
}

function randomCreatedAt(hoursBack: number, hoursForward: number): Date {
  const spanMs = (hoursBack + hoursForward) * 3600 * 1000;
  const startMs = Date.now() - hoursBack * 3600 * 1000;
  return new Date(startMs + Math.random() * spanMs);
}

interface AiAccount {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  persona: Persona;
  postingWeight: number;
}

/** Weighted allocation of `count` posts across accounts (with replacement). */
function allocate(accounts: AiAccount[], count: number): Map<string, number> {
  const totalWeight = accounts.reduce((sum, a) => sum + Math.max(0.01, a.postingWeight), 0);
  const tally = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    let r = Math.random() * totalWeight;
    let chosen = accounts[accounts.length - 1];
    for (const a of accounts) {
      r -= Math.max(0.01, a.postingWeight);
      if (r <= 0) {
        chosen = a;
        break;
      }
    }
    tally.set(chosen.id, (tally.get(chosen.id) ?? 0) + 1);
  }
  return tally;
}

/**
 * Generate a batch of AI posts across the AI accounts and store them.
 * Used by `npm run generate-ai-posts`, the admin UI and the cron endpoint.
 */
export async function generateAiPosts(opts: GenerateOptions): Promise<GenerateResult> {
  const count = Math.max(1, Math.floor(opts.count));
  const hoursBack = opts.hoursBack ?? 72;
  const hoursForward = opts.hoursForward ?? 0;
  const postsPerCall = Math.min(15, Math.max(1, opts.postsPerCall ?? 8));
  const concurrency = Math.min(6, Math.max(1, opts.concurrency ?? 2));
  const log = opts.log ?? (() => {});
  const provider = opts.provider ?? (await getTextProvider());

  const rows = await prisma.user.findMany({
    where: { accountType: "AI", ...(opts.userIds?.length ? { id: { in: opts.userIds } } : {}) },
    select: { id: true, username: true, displayName: true, bio: true, persona: true, postingWeight: true },
  });
  const accounts: AiAccount[] = rows.map((r) => ({
    ...r,
    persona: parsePersona(r.persona) ?? DEFAULT_PERSONA,
  }));
  if (accounts.length === 0) {
    throw new Error("No AI accounts found. Run `npm run db:seed` or create AI profiles in /admin first.");
  }

  // Global dedupe context: recent posts site-wide.
  const recent = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 600,
    select: { text: true, authorId: true },
  });
  const globalKeys = new Set(recent.map((p) => dedupeKey(p.text)));
  const globalPrefixes = new Set(recent.map((p) => dedupePrefix(p.text)));
  const avoidPool = recent.slice(0, 120).map((p) => p.text);

  const allocation = allocate(accounts, count);
  const jobs: Array<{ account: AiAccount; n: number }> = [];
  for (const account of accounts) {
    let remaining = allocation.get(account.id) ?? 0;
    while (remaining > 0) {
      const n = Math.min(postsPerCall, remaining);
      jobs.push({ account, n });
      remaining -= n;
    }
  }

  const result: GenerateResult = {
    requested: count,
    created: 0,
    discarded: 0,
    calls: 0,
    failedCalls: 0,
    errors: [],
    perUser: {},
    samples: [],
    provider: provider.name,
    model: provider.model,
    dryRun: Boolean(opts.dryRun),
  };

  let aborted = false;

  async function runJob(job: { account: AiAccount; n: number }) {
    if (aborted) return;
    const { account, n } = job;
    const own = await prisma.post.findMany({
      where: { authorId: account.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { text: true },
    });
    const ownKeys = new Set(own.map((p) => dedupeKey(p.text)));
    const examples = shuffle(own.map((p) => p.text)).slice(0, 8);
    const avoid = shuffle(avoidPool).slice(0, 25);

    const prompt = buildUserPrompt({
      persona: account.persona,
      displayName: account.displayName,
      bio: account.bio,
      examples,
      avoid,
      n: n + 2, // ask for a couple extra so we can discard the weak ones
    });

    result.calls += 1;
    let raw: string;
    try {
      raw = await provider.generateText({ system: SYSTEM_PROMPT, prompt, maxTokens: 2500 });
    } catch (err) {
      result.failedCalls += 1;
      const message = `@${account.username}: ${(err as Error).message}`;
      result.errors.push(message);
      log(`  x ${message}`);
      if (err instanceof AIConfigError) aborted = true;
      return;
    }

    const candidates = parsePostArray(raw);
    const accepted: string[] = [];
    for (const candidate of candidates) {
      if (accepted.length >= n) break;
      const cleaned = cleanGeneratedPost(candidate, account.persona);
      if (!cleaned) {
        result.discarded += 1;
        continue;
      }
      const key = dedupeKey(cleaned);
      const prefix = dedupePrefix(cleaned);
      if (globalKeys.has(key) || ownKeys.has(key) || globalPrefixes.has(prefix)) {
        result.discarded += 1;
        continue;
      }
      globalKeys.add(key);
      globalPrefixes.add(prefix);
      accepted.push(cleaned);
    }

    if (accepted.length === 0) {
      result.errors.push(`@${account.username}: model returned no usable posts`);
      return;
    }

    const data = accepted.map((text) => ({
      authorId: account.id,
      text,
      actualType: "AI" as const,
      createdAt: randomCreatedAt(hoursBack, hoursForward),
    }));
    if (!opts.dryRun) {
      await prisma.post.createMany({ data });
    }
    result.created += data.length;
    result.perUser[account.username] = (result.perUser[account.username] ?? 0) + data.length;
    for (const d of data.slice(0, 2)) {
      result.samples.push({ username: account.username, text: d.text, createdAt: d.createdAt.toISOString() });
    }
    log(`  + @${account.username}: ${data.length} posts (e.g. "${data[0].text.slice(0, 70)}")`);
  }

  log(`Generating ${count} posts across ${allocation.size} accounts in ${jobs.length} calls via ${provider.name}/${provider.model}${opts.dryRun ? " (dry run)" : ""}`);

  // Simple worker pool.
  const queue = [...jobs];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length && !aborted) {
      const job = queue.shift();
      if (job) await runJob(job);
    }
  });
  await Promise.all(workers);

  if (aborted && result.created === 0) {
    throw new AIConfigError(result.errors[0] ?? "AI provider is not configured");
  }
  return result;
}
