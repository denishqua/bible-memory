// Tokenizes already-cleaned verse text into the units the review engine drives
// off of: words to type, poetry line breaks, and (per spec-review fix #4)
// verse-number markers kept as non-matchable, display-only context.

export interface Token {
  raw: string; // original substring incl. punctuation, for display
  matchable: boolean; // false for punctuation-only/whitespace tokens, line breaks, and verse-number markers
  normalized: string; // lowercased, punctuation-stripped except internal hyphen/apostrophe
  isLineBreak?: boolean; // poetry line break, never typed
  // Not part of the plan's original 4-field Token shape, but a cheap, additive
  // marker so a later UI phase can render verse-number tokens distinctly (e.g.
  // superscript) instead of re-deriving "is this a verse number" from `raw` via
  // regex again. Never used for skip logic — `matchable === false` already
  // covers that uniformly for line breaks, verse-number markers, and stray
  // punctuation-only tokens alike.
  isVerseNumber?: boolean;
}

// Convention assumed for verse-number markers in the *input* to tokenize():
// a standalone bracketed integer, e.g. "[16]", surrounded by whitespace (or at a
// text boundary). This mirrors how the ESV API itself renders verse numbers when
// `include-verse-numbers=true` is requested (the option the plan's esvApi.ts
// calls for specifically so cleanup can choose to keep them). The not-yet-built
// `verseTextCleanup.ts` is expected to normalize whatever the API/manual entry
// produces into this "[N]" form and leave it in place (never strip it), per
// spec-review fix #4 — this file documents that assumption since cleanup lands
// in a later phase and isn't implemented yet.
//
// A verse number fused directly onto the next word with no separating
// whitespace (e.g. a raw "16For" before cleanup runs) is NOT handled here —
// splitting that apart is cleanup's job; tokenize() only ever sees clean input.
const VERSE_NUMBER_RE = /^\[\d+\]$/;

// Characters kept as part of a word's normalized form even though they're not
// letters/digits: internal hyphens ("self-control") and apostrophes, including
// the curly variant ESV-style text tends to use for contractions ("don't" / "don’t").
const KEEP_IN_WORD_RE = /[^\p{L}\p{N}'’-]/gu;
// Trim any hyphen/apostrophe that ends up at the very start or end after stripping
// (e.g. a leading curly opening quote around a hyphenated word) — only *internal*
// hyphens/apostrophes should ever survive into `normalized`.
const EDGE_TRIM_RE = /^['’-]+|['’-]+$/g;

function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(KEEP_IN_WORD_RE, "").replace(EDGE_TRIM_RE, "");
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Match either a newline (poetry line break) or a run of non-whitespace
  // characters (a word/marker/punctuation chunk). Plain spaces/tabs between
  // chunks are separators only — they never become tokens themselves.
  const chunks = text.match(/\n|\S+/g) ?? [];

  for (const chunk of chunks) {
    if (chunk === "\n") {
      tokens.push({ raw: chunk, matchable: false, normalized: "", isLineBreak: true });
      continue;
    }

    if (VERSE_NUMBER_RE.test(chunk)) {
      tokens.push({ raw: chunk, matchable: false, normalized: "", isVerseNumber: true });
      continue;
    }

    const normalized = normalizeWord(chunk);
    tokens.push({ raw: chunk, matchable: normalized.length > 0, normalized });
  }

  return tokens;
}
