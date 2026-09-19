import type { Persona } from "./personas";
import { POST_MAX_LENGTH, normalizeText } from "@/lib/validation";

/**
 * Phrases that scream "a language model wrote this". Generated posts that
 * contain any of them are thrown away.
 */
export const BANNED_PHRASES: string[] = [
  "there's something about",
  "theres something about",
  "there is something about",
  "am i the only one",
  "it's fascinating how",
  "its fascinating how",
  "in today's world",
  "in todays world",
  "honestly, i've been thinking",
  "honestly i've been thinking",
  "i've been thinking a lot",
  "let that sink in",
  "in a world where",
  "it's wild how",
  "its wild how",
  "it's crazy how",
  "its crazy how",
  "the little things",
  "small things in life",
  "delve",
  "tapestry",
  "testament to",
  "as an ai",
  "language model",
  "i'm an ai",
  "im an ai",
  "a reminder that",
  "gentle reminder",
  "friendly reminder",
  "daily reminder",
  "here's to",
  "heres to",
  "isn't it funny how",
  "isnt it funny how",
  "funny how",
  "plot twist:",
  "unpopular opinion:",
  "hot take:",
  "the human experience",
  "in this economy",
  "moment of appreciation",
  "shoutout to",
  "shout out to",
  "you know what",
  "that feeling when",
  "there's a certain",
  "nothing quite like",
  "nothing like a",
  "hits different",
  "living my best life",
  "adulting",
  "mood:",
  "big mood",
  "core memory",
];

/** Returns the first banned phrase found, or null. */
export function findBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

/** Loose key for detecting near-duplicate posts. */
export function dedupeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(EMOJI_RE, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same as dedupeKey but only the first few words, to catch "same idea, different ending". */
export function dedupePrefix(text: string, words = 6): string {
  return dedupeKey(text).split(" ").slice(0, words).join(" ");
}

/**
 * Normalize a generated post and enforce the persona's mechanical style
 * rules. Returns null when the post should be discarded.
 */
export function cleanGeneratedPost(raw: string, persona: Persona): string | null {
  let text = normalizeText(String(raw ?? ""));
  if (!text) return null;

  // Strip wrapping quotes / list markers / numbering the model sometimes adds.
  text = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  text = text.replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "").trim();

  // Typographic tells that real people rarely type on their phone.
  text = text
    .replace(/\s*[—–]\s*/g, " - ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/;/g, ",");

  // No @mentions, no links, at most one hashtag.
  if (/@[a-z0-9_]{2,}/i.test(text)) return null;
  if (/https?:\/\//i.test(text) || /\bwww\./i.test(text)) return null;
  if ((text.match(/#\w+/g) ?? []).length > 1) return null;

  if (findBannedPhrase(text)) return null;

  // Persona mechanics.
  if (persona.capitalization === "lowercase") {
    text = text.toLowerCase();
  }
  if (persona.punctuation === "none" || persona.punctuation === "minimal") {
    text = text.replace(/[.]+$/g, "").trim();
  }
  if (persona.punctuation === "none") {
    // Drop most commas but keep the odd one so it doesn't look mechanical.
    text = text.replace(/,(?=\s)/g, (m, offset: number) => (offset % 3 === 0 ? m : ""));
  }
  if (persona.emoji === "never") {
    text = text.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
  }

  text = normalizeText(text);
  if (!text) return null;
  if (text.length > POST_MAX_LENGTH) return null;
  // Essays are a tell.
  if (text.split(/\s+/).length > 110) return null;
  return text;
}

/**
 * Extract a JSON array of strings from a model response, tolerating code
 * fences and leading/trailing chatter. Falls back to line splitting.
 */
export function parsePostArray(response: string): string[] {
  const trimmed = response.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      // fall through to line parsing
    }
  }
  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[\[\]{},]*$/.test(line))
    .map((line) => line.replace(/^["']|["'],?$/g, ""));
}
