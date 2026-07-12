export interface VerseWord {
  /** Leading punctuation/whitespace-adjacent characters kept for display, e.g. an opening quote. */
  prefix: string;
  /** The lettered core the user must actually type, e.g. "loved" or "God's". */
  core: string;
  /** Trailing punctuation kept for display, e.g. a comma or period. */
  suffix: string;
}

const CORE_CHAR = /['A-Za-z]/;

/** Splits verse text into words, separating each into display punctuation and a typeable core. */
export function splitVerseIntoWords(text: string): VerseWord[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      let start = 0;
      let end = token.length;
      while (start < end && !CORE_CHAR.test(token[start])) start += 1;
      while (end > start && !CORE_CHAR.test(token[end - 1])) end -= 1;
      return {
        prefix: token.slice(0, start),
        core: token.slice(start, end),
        suffix: token.slice(end),
      };
    });
}

export function isWordCorrect(input: string, core: string): boolean {
  return input.trim().toLowerCase() === core.toLowerCase();
}

/**
 * Masks a word's core down to its first letter plus `extraRevealed` progressively
 * hinted letters, with underscores standing in for the rest.
 */
export function maskWord(core: string, extraRevealed: number): string {
  if (core.length === 0) return '';
  const revealed = Math.min(core.length, 1 + Math.max(0, extraRevealed));
  return core.slice(0, revealed) + '_'.repeat(core.length - revealed);
}
