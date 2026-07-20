// Single-verse review reuses the exact same tokenizer/engine as the verse
// itself — the reference is folded into ONE continuous session rather than a
// separate end-of-review step. After the verse's tokens, a subtle delimiter and
// then the reference (tokenized the same way the verse is) are appended, all
// flagged `isReference`. The reference words are normal matchable tokens, so
// they flow into accuracy / the mastery score naturally; buildInitialWords just
// forces them masked so recalling the reference is a genuine challenge even when
// the verse itself is fully visible (Type It).
//
// The three single-verse callers (ReviewPage, GatePage, RandomReviewFlow) all
// build their token stream through here so the "verse + reference" construction
// lives in one place; bulk multi-verse review (buildCollectionReviewTokens) has
// no single reference and is deliberately left untouched.
import { tokenize, type Token } from "./tokenize";

// The muted marker shown between the verse and the appended reference so the
// reader can tell they've moved from recalling the verse to recalling its
// reference. Non-matchable (never typed) and flagged `isReference` so the
// verse-boundary detectors never mistake it for a between-verse collection
// reference marker. WordToken renders it as inline muted context; BuiltVerse
// (arcade) renders it as its own divider line, same as a collection marker.
export const REFERENCE_DELIMITER_RAW = "— reference —";

const LINE_BREAK_TOKEN: Token = { raw: "\n", matchable: false, normalized: "", isLineBreak: true };

const REFERENCE_DELIMITER_TOKEN: Token = {
  raw: REFERENCE_DELIMITER_RAW,
  matchable: false,
  normalized: "",
  isReference: true,
};

// Verse tokens + delimiter + the reference tokens (each flagged isReference).
// A blank/whitespace-only reference tokenizes to nothing, in which case the
// verse stream is returned unchanged (no delimiter, no reference) — a safe
// no-op so a reference-less verse behaves exactly like plain review.
export function buildVerseReviewTokens(text: string, reference: string): Token[] {
  const verseTokens = tokenize(text);
  const referenceTokens = tokenize(reference).map((token) => ({ ...token, isReference: true }));
  if (referenceTokens.length === 0) return verseTokens;
  return [
    ...verseTokens,
    LINE_BREAK_TOKEN,
    REFERENCE_DELIMITER_TOKEN,
    LINE_BREAK_TOKEN,
    ...referenceTokens,
  ];
}

// The number of completed VERSE words (the verse's matchable words, NOT the
// appended reference) after which the reference heading is hidden from the host
// chrome. ceil(25%) — e.g. a 10-word verse hides after the 3rd word
// (ceil(2.5) = 3); a 1–4 word verse after the 1st (ceil(≤1) = 1).
export function referenceHideThreshold(verseMatchableCount: number): number {
  return Math.ceil(0.25 * verseMatchableCount);
}

// Whether the reference heading should be hidden yet, given how many of the
// verse's own matchable words have been completed. Stays true once reached
// (both counts only grow within a run). A verse with no matchable words never
// hides (degenerate input — nothing to reveal anyway).
export function shouldHideReference(
  verseMatchableCount: number,
  completedVerseWords: number,
): boolean {
  if (verseMatchableCount === 0) return false;
  return completedVerseWords >= referenceHideThreshold(verseMatchableCount);
}
