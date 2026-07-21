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
import type { ReviewMode } from "../types/review";

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
  isReferenceDelimiter: true,
};

// Tokenize a reference (e.g. "Psalm 16:2-3") for inline recall. Unlike the verse
// tokenizer, a reference is recalled digit-by-digit: each DIGIT is its own
// matchable token (so first-letter typing is 1,6,2,3 — not just "1" for the
// whole "16:2-3" chunk), each letter run is one matchable word (the book name,
// typed first-letter / whole-word like any verse word), and punctuation (":",
// "-", ".") is non-matchable context shown but never typed. `attachNext` keeps a
// whitespace-free run (the number group) rendering tight as "16:2-3".
function tokenizeReference(reference: string): Token[] {
  const tokens: Token[] = [];
  // Whitespace-separated chunks mark where real spaces belong; within a chunk,
  // every piece attaches to the next so the group renders with no gaps.
  for (const chunk of reference.match(/\S+/g) ?? []) {
    const pieces = chunk.match(/\p{L}+|\d|[^\p{L}\p{N}]+/gu) ?? [];
    pieces.forEach((piece, i) => {
      const attachNext = i < pieces.length - 1;
      if (/^\d$/.test(piece)) {
        tokens.push({ raw: piece, matchable: true, normalized: piece, attachNext });
      } else if (/^\p{L}+$/u.test(piece)) {
        tokens.push({ raw: piece, matchable: true, normalized: piece.toLowerCase(), attachNext });
      } else {
        // Punctuation between numbers (":", "-"): shown as context, never typed.
        tokens.push({ raw: piece, matchable: false, normalized: "", attachNext });
      }
    });
  }
  return tokens;
}

// Verse tokens + delimiter + the reference tokens (each flagged isReference).
// A blank/whitespace-only reference tokenizes to nothing, in which case the
// verse stream is returned unchanged (no delimiter, no reference) — a safe
// no-op so a reference-less verse behaves exactly like plain review.
export function buildVerseReviewTokens(text: string, reference: string, mode?: ReviewMode): Token[] {
  let verseTokens = tokenize(text);
  if (mode === "reference-it") {
    verseTokens = verseTokens.map((token) => {
      if (token.isLineBreak || token.isVerseNumber) return token;
      return { ...token, matchable: false, isVerseText: true };
    });
  }
  const referenceTokens = tokenizeReference(reference).map((token) => ({ ...token, isReference: true }));
  if (referenceTokens.length === 0) return verseTokens;
  return [
    ...verseTokens,
    LINE_BREAK_TOKEN,
    REFERENCE_DELIMITER_TOKEN,
    LINE_BREAK_TOKEN,
    ...referenceTokens,
  ];
}

// For the ARCADE modes (Verse Defender / Lane Defender), a reference number is
// played as ONE target rather than digit-by-digit: "16:12-15" → targets 16, 12,
// 15 (not 1,6,1,2,1,5). Merge each run of adjacent single-digit reference tokens
// back into one number token. The text modes keep the per-digit tokens (typed
// 1,6,… individually, or continuously in whole-word), so this runs only on the
// arcade branch of renderSession — it's never baked into the shared stream.
export function mergeReferenceNumbers(tokens: Token[]): Token[] {
  const isRefNumber = (token: Token | undefined, re: RegExp): boolean =>
    token !== undefined && token.isReference === true && token.matchable && re.test(token.normalized);
  const out: Token[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    // Fold a digit into the previous number only when that number's tail was
    // marked to attach to it (same whitespace-free group) — so a "16" and a
    // separate "2" (e.g. "Ps 16 2") stay apart.
    if (isRefNumber(token, /^\d$/) && isRefNumber(prev, /^\d+$/) && prev.attachNext) {
      out[out.length - 1] = {
        ...prev,
        raw: prev.raw + token.raw,
        normalized: prev.normalized + token.normalized,
        attachNext: token.attachNext,
      };
    } else {
      out.push(token);
    }
  }
  return out;
}

// How many Bible verses a reference label spans, for shield budgeting in the
// arcade modes (2 shields per verse). Parses the verse spec after the LAST
// colon — everything before it is book + chapter (a book name may itself start
// with a number, e.g. "1 John 2:1", so we can't just grab the last number).
//   "John 3:16"        → 1   (single verse)
//   "Ephesians 2:8-10" → 3   (inclusive range)
//   "Ephesians 2:8, 10"→ 2   (comma list)
// Anything unrecognized (no colon — a whole-chapter "Psalm 23" — or an
// unparseable/cross-chapter spec) falls back to 1: never fewer shields than the
// old always-1 behavior.
export function countReferenceVerses(reference: string): number {
  const lastColon = reference.lastIndexOf(":");
  if (lastColon === -1) return 1;
  const spec = reference.slice(lastColon + 1).trim();

  let total = 0;
  for (const part of spec.split(",")) {
    const range = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      total += end >= start ? end - start + 1 : 1;
      continue;
    }
    if (/^\d+$/.test(part.trim())) total += 1;
  }

  return total < 1 ? 1 : total;
}

// Reconstruct the reference label from the reference tokens appended by
// buildVerseReviewTokens (isReference, minus the "— reference —" divider) and
// count the verses it spans. The tokens carry the same `attachNext` grouping
// tokenizeReference used, so joining raw pieces with a space wherever the group
// breaks reproduces the original label ("Ephesians 2:8-10"). Works on both the
// per-digit stream and the arcade's mergeReferenceNumbers output, since parsing
// keys off the colon and hyphen, not on how the digits are grouped. Returns 1
// when no reference was appended (blank reference / non-single-verse streams).
export function countPassageVerses(tokens: Token[]): number {
  const referenceTokens = tokens.filter((t) => t.isReference && !t.isReferenceDelimiter);
  if (referenceTokens.length === 0) return 1;

  let label = "";
  referenceTokens.forEach((token, i) => {
    label += token.raw;
    if (token.attachNext !== true && i < referenceTokens.length - 1) label += " ";
  });

  return countReferenceVerses(label);
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
