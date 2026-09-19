/**
 * Everything brand-related lives here so the name / tagline can be changed in
 * one place. The logo mark is in src/components/Logo.tsx and the accent color
 * is the --accent CSS variable in src/app/globals.css.
 */
export const SITE = {
  name: "Human?",
  tagline: "A feed where you guess who's real.",
  description:
    "A social feed where humans and AI both post. Read a post, guess whether a person or a machine wrote it, and find out how good your instincts really are.",
  /** Used for the <title> template. */
  titleTemplate: "%s · Human?",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
