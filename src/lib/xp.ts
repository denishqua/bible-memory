export const BASE_XP_PER_VERSE = 20;
export const COMBO_BONUS_XP_PER_WORD = 1;
export const COMBO_BONUS_THRESHOLD = 3;
export const HINT_XP_PENALTY = 3;

/** XP curve: level n requires round(50 * n^1.5, nearest 10) cumulative XP. */
export function xpForLevel(level: number): number {
  return Math.round((50 * Math.pow(level, 1.5)) / 10) * 10;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) {
    level += 1;
  }
  return level;
}

export function xpProgressWithinLevel(xp: number): { level: number; into: number; span: number } {
  const level = levelFromXp(xp);
  const floor = level === 1 ? 0 : xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, into: xp - floor, span: ceil - floor };
}

interface WordResult {
  correct: boolean;
  hinted: boolean;
}

/**
 * Computes XP earned for one verse attempt. Base XP scales with first-try accuracy
 * (full 20 XP only for a perfectly clean pass), plus a per-word combo bonus and a
 * per-hint penalty applied while walking through the words in order.
 */
export function calculateVerseXp(words: WordResult[], accuracy: number): number {
  let xp = Math.round(BASE_XP_PER_VERSE * accuracy);
  let combo = 0;

  for (const word of words) {
    if (word.hinted) {
      combo = 0;
      xp -= HINT_XP_PENALTY;
      continue;
    }
    if (word.correct) {
      combo += 1;
      xp += combo >= COMBO_BONUS_THRESHOLD ? COMBO_BONUS_XP_PER_WORD : 0;
    } else {
      combo = 0;
    }
  }

  return Math.max(0, xp);
}
