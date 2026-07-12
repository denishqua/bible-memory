// Bulk collection review reuses the exact same tokenizer/engine as single-verse
// review — concatenation happens here, at the call site, never inside
// tokenize.ts itself. Each verse is tokenized individually, then a small
// non-matchable, display-only reference marker is spliced in between verses
// (never before the first) so the reader always knows which verse they've
// moved into without it ever being part of the typed stream. This reuses the
// exact same "matchable: false" convention tokenize.ts already uses for
// verse-number markers and line breaks — WordToken.tsx renders any
// non-matchable, non-line-break token as muted context text with no changes
// needed there.
import { tokenize, type Token } from "./tokenize";
import type { Verse } from "../types/verse";

function referenceMarkerToken(reference: string): Token {
  return {
    raw: `— ${reference} —`,
    matchable: false,
    normalized: "",
  };
}

const LINE_BREAK_TOKEN: Token = { raw: "\n", matchable: false, normalized: "", isLineBreak: true };

// `verses` must already be ordered by date-added (CollectionVerseLink.addedAt)
// — ordering is the caller's responsibility (see useCollections.getVerseIdsForCollection).
export function buildCollectionReviewTokens(verses: Verse[]): Token[] {
  const tokens: Token[] = [];
  verses.forEach((verse, i) => {
    if (i > 0) {
      // Between verses only — a single-verse collection must tokenize
      // identically to plain single-verse review, with no marker at all.
      tokens.push(LINE_BREAK_TOKEN);
      tokens.push(referenceMarkerToken(verse.reference));
      tokens.push(LINE_BREAK_TOKEN);
    }
    tokens.push(...tokenize(verse.text));
  });
  return tokens;
}
