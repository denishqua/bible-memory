export type BoxLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type VerseStatus = 'learning' | 'reviewing' | 'mastered';

export interface VerseProgress {
  verseId: string;
  boxLevel: BoxLevel;
  nextReviewDate: string;
  lastReviewedDate: string | null;
  consecutiveCorrect: number;
  totalAttempts: number;
  totalCorrect: number;
  bestAccuracy: number;
  status: VerseStatus;
}
