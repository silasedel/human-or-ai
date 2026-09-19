import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { hydratePosts, postSelect, type PostDTO } from "@/lib/feed";
import { shuffle } from "@/lib/utils";
import { AIConfigError, getTextProvider } from "./provider";
import { DEFAULT_PERSONA, describePersona, type Persona } from "./personas";
import { SYSTEM_PROMPT } from "./generate";
import { cleanGeneratedPost, dedupeKey, parsePostArray } from "./filters";

/**
 * "Let an AI post for me": a human account asks the model to write one post in
 * their own voice (based on their earlier posts). The post is published under
 * their account but stored as AI, so the guessing game stays honest and
 * nobody can rely on "this account is a person" alone.
 */
export async function ghostwritePost(userId: string, hint?: string): Promise<PostDTO> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true, bio: true, accountType: true },
  });
  if (!user) throw new HttpError(401, "Account not found");

  let provider;
  try {
    provider = await getTextProvider();
  } catch (err) {
    if (err instanceof AIConfigError) throw new HttpError(503, "AI writing is not enabled on this site");
    throw err;
  }

  const own = await prisma.post.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { text: true },
  });
  const examples = shuffle(own.map((p) => p.text)).slice(0, 10);
  const ownKeys = new Set(own.map((p) => dedupeKey(p.text)));

  const persona: Persona = {
    ...DEFAULT_PERSONA,
    summary: `${user.displayName}, a regular person who uses this site`,
    voice:
      examples.length >= 3
        ? "Match the voice of this account's earlier posts exactly: same capitalization habits, same punctuation habits, same slang level, same typical length, same kind of topics. If they type lowercase, type lowercase. If they never use emojis, don't."
        : "A normal person posting from their phone. Casual, specific, a little unpolished. No jokes explained, no lessons.",
    interests: [],
    capitalization: "mixed",
    punctuation: "minimal",
    emoji: "rare",
    length: "mixed",
    slang: "light",
    grammar: "casual",
    asksQuestions: false,
    tellsStories: false,
    quirks: [],
  };

  const parts: string[] = [];
  parts.push("PERSONA\n" + describePersona(persona, user.displayName, user.bio));
  if (examples.length) {
    parts.push(
      "EARLIER POSTS FROM THIS ACCOUNT (match the voice; do not reuse these topics):\n" +
        examples.map((e) => `- ${e.replace(/\n/g, " ")}`).join("\n"),
    );
  }
  parts.push(
    "TASK\nWrite 3 candidate posts from this account" +
      (hint ? ` about: "${hint.replace(/"/g, "'")}"` : ", each about a different small everyday thing") +
      ". Vary the length: one very short, one a single sentence, one two or three sentences. Return only a JSON array of 3 strings.",
  );

  const raw = await provider.generateText({ system: SYSTEM_PROMPT, prompt: parts.join("\n\n"), maxTokens: 800 });
  const candidates = parsePostArray(raw);
  const usable = shuffle(candidates)
    .map((c) => cleanGeneratedPost(c, persona))
    .filter((c): c is string => Boolean(c) && !ownKeys.has(dedupeKey(c as string)));

  if (usable.length === 0) throw new HttpError(502, "The AI didn't come up with anything usable. Try again.");

  const row = await prisma.post.create({
    data: { authorId: userId, text: usable[0], actualType: "AI" },
    select: postSelect,
  });
  const [dto] = await hydratePosts([row], { userId, guestId: null });
  return dto;
}
