import type { BoxLevel, VerseProgress } from '../types';

export const BOX_INTERVAL_DAYS: Record<BoxLevel, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 7,
  4: 16,
  5: 35,
};

export const PASS_ACCURACY_THRESHOLD = 0.6;

export function todayISODate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function addDaysISODate(baseDate: string, days: number): string {
  const d = new Date(`${baseDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createInitialProgress(verseId: string, now: Date): VerseProgress {
  const today = todayISODate(now);
  return {
    verseId,
    boxLevel: 0,
    nextReviewDate: today,
    lastReviewedDate: null,
    consecutiveCorrect: 0,
    totalAttempts: 0,
    totalCorrect: 0,
    bestAccuracy: 0,
    status: 'learning',
  };
}

/** Applies the result of one verse attempt to its progress record (Leitner box move). */
export function applyAttemptResult(
  progress: VerseProgress,
  accuracy: number,
  now: Date
): VerseProgress {
  const today = todayISODate(now);
  const passed = accuracy >= PASS_ACCURACY_THRESHOLD;
  const nextBox = clampBox(passed ? progress.boxLevel + 1 : progress.boxLevel - 1);

  return {
    ...progress,
    boxLevel: nextBox,
    nextReviewDate: addDaysISODate(today, BOX_INTERVAL_DAYS[nextBox]),
    lastReviewedDate: today,
    consecutiveCorrect: passed ? progress.consecutiveCorrect + 1 : 0,
    totalAttempts: progress.totalAttempts + 1,
    totalCorrect: progress.totalCorrect + (passed ? 1 : 0),
    bestAccuracy: Math.max(progress.bestAccuracy, accuracy),
    status: nextBox >= 5 ? 'mastered' : nextBox === 0 ? 'learning' : 'reviewing',
  };
}

function clampBox(box: number): BoxLevel {
  return Math.max(0, Math.min(5, box)) as BoxLevel;
}
