import type { VerseProgress } from '../../types';
import type { ProgressStore } from '../types';
import { db } from './db';

export class LocalProgressStore implements ProgressStore {
  getAllProgress(): Promise<VerseProgress[]> {
    return db.progress.toArray();
  }

  getProgress(verseId: string): Promise<VerseProgress | undefined> {
    return db.progress.get(verseId);
  }

  getDueForReview(asOfDate: string): Promise<VerseProgress[]> {
    return db.progress.where('nextReviewDate').belowOrEqual(asOfDate).toArray();
  }

  async upsertProgress(progress: VerseProgress): Promise<void> {
    await db.progress.put(progress);
  }
}
