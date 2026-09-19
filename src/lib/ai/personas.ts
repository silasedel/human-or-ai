import { z } from "zod";

/**
 * A persona is the persistent personality + writing-style record stored on
 * each AI account (User.persona). The generator turns it into prompt text so
 * the account keeps a consistent, distinct voice across batches.
 */
export const personaSchema = z.object({
  /** One line: who this person is. */
  summary: z.string().trim().min(3).max(300),
  /** Free-form description of how they write (the most important field). */
  voice: z.string().trim().min(10).max(2000),
  interests: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  capitalization: z.enum(["lowercase", "normal", "mixed"]).default("normal"),
  punctuation: z.enum(["none", "minimal", "normal", "heavy"]).default("normal"),
  emoji: z.enum(["never", "rare", "sometimes", "often"]).default("rare"),
  length: z.enum(["very short", "short", "medium", "long", "mixed"]).default("mixed"),
  slang: z.enum(["none", "light", "heavy"]).default("light"),
  grammar: z.enum(["sloppy", "casual", "clean"]).default("casual"),
  asksQuestions: z.boolean().default(false),
  tellsStories: z.boolean().default(false),
  quirks: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
});

export type Persona = z.infer<typeof personaSchema>;
export type PersonaInput = z.input<typeof personaSchema>;

export function parsePersona(value: unknown): Persona | null {
  const result = personaSchema.safeParse(value);
  return result.success ? result.data : null;
}

export const DEFAULT_PERSONA: Persona = {
  summary: "Regular person in their 20s who posts about their day",
  voice: "Casual, short, a little dry. Posts about small everyday things.",
  interests: ["food", "tv", "work"],
  capitalization: "normal",
  punctuation: "minimal",
  emoji: "rare",
  length: "mixed",
  slang: "light",
  grammar: "casual",
  asksQuestions: false,
  tellsStories: false,
  quirks: [],
};

const CAPITALIZATION_TEXT: Record<Persona["capitalization"], string> = {
  lowercase: "Everything in lowercase, always. Even names, even 'i'. Never capitalize the first word.",
  normal: "Normal capitalization (first letter of sentences, names).",
  mixed: "Inconsistent capitalization: sometimes starts a post capitalized, sometimes not. Doesn't care.",
};

const PUNCTUATION_TEXT: Record<Persona["punctuation"], string> = {
  none: "Almost no punctuation. No period at the end. Commas are rare. Run-on sentences are fine.",
  minimal: "Light punctuation: usually no period at the end of the post, commas only when needed.",
  normal: "Regular punctuation, but nothing fancy. Ends most posts with a period or nothing.",
  heavy: "Uses punctuation expressively: exclamation marks, ellipses..., multiple question marks?? sometimes.",
};

const EMOJI_TEXT: Record<Persona["emoji"], string> = {
  never: "Never uses emojis.",
  rare: "Very rarely uses an emoji (maybe 1 in 10 posts, and only one).",
  sometimes: "Sometimes ends a post with an emoji (about 1 in 3 posts). Never more than two.",
  often: "Uses emojis often, sometimes a couple in a row, usually at the end of the post.",
};

const LENGTH_TEXT: Record<Persona["length"], string> = {
  "very short": "Posts are tiny: 2-8 words is typical. Never more than one sentence.",
  short: "Posts are short: a few words to one sentence. Occasionally two short sentences.",
  medium: "Posts are usually one or two sentences. Sometimes three.",
  long: "Often posts 2-4 sentences, sometimes a short paragraph telling a small story. Still occasionally posts one-liners.",
  mixed: "Length varies wildly: some posts are three words, some are a couple sentences, one in ten is a short paragraph.",
};

const SLANG_TEXT: Record<Persona["slang"], string> = {
  none: "No internet slang. Talks like a normal adult, maybe slightly old-fashioned.",
  light: "Occasional casual internet shorthand (lol, tbh, idk, ngl) but not in every post.",
  heavy: "Lots of current internet slang and shorthand (fr, lowkey, bro, bruh, istg, rn, lmao, deadass, no bc). Very online.",
};

const GRAMMAR_TEXT: Record<Persona["grammar"], string> = {
  sloppy: "Grammar is sloppy: occasional typos, missing apostrophes (dont, im, cant), doubled words, wrong homophones. Never corrects itself.",
  casual: "Casual grammar: mostly fine but relaxed, sometimes skips apostrophes or drops a word.",
  clean: "Clean grammar and spelling. Still casual in tone, not formal.",
};

/** Render a persona as instructions for the generation prompt. */
export function describePersona(p: Persona, displayName: string, bio: string): string {
  const lines: string[] = [];
  lines.push(`Who they are: ${p.summary}`);
  lines.push(`Display name: ${displayName}. Profile bio: "${bio || "(none)"}"`);
  lines.push(`How they write: ${p.voice}`);
  if (p.interests.length) lines.push(`Things they tend to post about: ${p.interests.join(", ")}.`);
  lines.push(`Capitalization: ${CAPITALIZATION_TEXT[p.capitalization]}`);
  lines.push(`Punctuation: ${PUNCTUATION_TEXT[p.punctuation]}`);
  lines.push(`Emoji: ${EMOJI_TEXT[p.emoji]}`);
  lines.push(`Length: ${LENGTH_TEXT[p.length]}`);
  lines.push(`Slang: ${SLANG_TEXT[p.slang]}`);
  lines.push(`Grammar: ${GRAMMAR_TEXT[p.grammar]}`);
  lines.push(
    p.asksQuestions
      ? "Questions: they ask the void questions fairly often (about a third of posts)."
      : "Questions: they rarely post questions. Almost everything is a statement.",
  );
  lines.push(
    p.tellsStories
      ? "Stories: they like telling little stories about something that happened to them."
      : "Stories: they don't really narrate events; posts are mostly quick thoughts or reactions.",
  );
  if (p.quirks.length) lines.push(`Quirks: ${p.quirks.map((q) => `- ${q}`).join("\n")}`);
  return lines.join("\n");
}

/**
 * Turn a persona's length preference into an explicit count breakdown so
 * every batch has real variety instead of uniform medium-length posts.
 */
export function lengthPlan(p: Persona, n: number): string {
  const weights: Record<Persona["length"], [number, number, number, number]> = {
    // [tiny (2-6 words), one sentence, 2-3 sentences, short paragraph]
    "very short": [0.7, 0.3, 0, 0],
    short: [0.4, 0.5, 0.1, 0],
    medium: [0.15, 0.45, 0.35, 0.05],
    long: [0.1, 0.25, 0.4, 0.25],
    mixed: [0.3, 0.35, 0.25, 0.1],
  };
  const w = weights[p.length];
  const counts = w.map((x) => Math.floor(x * n));
  let assigned = counts.reduce((a, b) => a + b, 0);
  let i = 1;
  while (assigned < n) {
    counts[i % 4] += 1;
    assigned += 1;
    i += 1;
  }
  const parts: string[] = [];
  if (counts[0]) parts.push(`${counts[0]} that are just a few words (2-6 words)`);
  if (counts[1]) parts.push(`${counts[1]} that are exactly one sentence`);
  if (counts[2]) parts.push(`${counts[2]} that are two or three sentences`);
  if (counts[3]) parts.push(`${counts[3]} that are a short paragraph (4-6 sentences, telling a small story)`);
  return parts.join(", ");
}
