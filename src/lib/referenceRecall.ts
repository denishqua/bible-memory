// Shared logic for the "type the reference" recall step that caps off every
// review (all 3 text modes + both arcade modes): after the verse itself is
// finished, the player produces the reference (e.g. "John 3:16") from memory so
// they learn the label, not just the words. Two input styles, each matching
// whatever style the host session already uses:
//
//   • first-letter — the player types the first character of each reference
//     token in order. A maximal run of letters is ONE token (its first letter,
//     mirroring how the first-letter typing modes clear a whole word with a
//     single keystroke); each digit is its own token. "John 3:16" → the
//     keystroke sequence j,3,1,6.
//   • whole-word — the player types the reference out and it is matched
//     FORGIVINGLY: case, surrounding/extra punctuation, and whitespace runs are
//     all ignored, so "john 3 16" matches "John 3:16".
//
// Kept DOM-free and framework-free (like tokenize.ts and the engine files) so
// it can be unit-tested directly and reused by every session component.

export type ReferenceInputStyle = "first-letter" | "whole-word";

// Whole-word forgiving normalization: lowercase, then collapse every run of
// non-alphanumeric characters (spaces, ":", "-", ",", …) to a single space and
// trim the ends. Unicode-aware (\p{L}/\p{N}) so accented references normalize
// too. "  John,  3 : 16 " and "john 3 16" both → "john 3 16".
export function normalizeReference(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Whole-word match: forgiving equality of the two normalized forms.
export function matchesReferenceWholeWord(input: string, reference: string): boolean {
  return normalizeReference(input) === normalizeReference(reference);
}

// The ordered first-letter keystroke sequence for a reference: one entry per
// token, each the (lowercased) character the player must press to clear that
// token. A maximal run of letters is a single token (its first letter); each
// digit is its own token. Everything else (spaces, ":", "-") is a separator and
// contributes no keystroke. "John 3:16" → ["j","3","1","6"].
export function referenceFirstLetterSequence(reference: string): string[] {
  const tokens = reference.match(/\p{L}+|\p{N}/gu) ?? [];
  return tokens.map((token) => token[0].toLowerCase());
}
