/** Small pool of common short words used to pad distractor options when a verse is too short. */
const FALLBACK_WORDS = ['the', 'and', 'in', 'of', 'to', 'a', 'is', 'for', 'that', 'you', 'your', 'God'];

/** Fisher-Yates shuffle; returns a new array, does not mutate the input. */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks up to `count` plausible wrong options for a multiple-choice word prompt,
 * drawn from the verse's own other words (deduped, case-insensitive, excluding the
 * correct word itself). Pads with a small fallback pool of common short words if the
 * verse doesn't have enough unique other words.
 */
export function pickDistractors(correctWord: string, allWordsInVerse: string[], count: number): string[] {
  const seen = new Set<string>([correctWord.toLowerCase()]);
  const picked: string[] = [];

  for (const word of shuffle(allWordsInVerse)) {
    if (picked.length >= count) break;
    const lower = word.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    picked.push(word);
  }

  if (picked.length < count) {
    for (const word of shuffle(FALLBACK_WORDS)) {
      if (picked.length >= count) break;
      const lower = word.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      picked.push(word);
    }
  }

  return picked;
}
