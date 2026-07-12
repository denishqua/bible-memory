import type { Collection, Verse, VerseProgress } from '../types';

/**
 * Builds a single mixed practice queue of verses that are due today, pulled
 * across every set the user has created.
 *
 * Sorted by nextReviewDate (most overdue first), then by the verse's own
 * `createdAt` as a tiebreaker for stable, predictable ordering.
 */
export function buildDueQueueAcrossCollections(
  collections: Collection[],
  progressByVerseId: Map<string, VerseProgress>,
  versesById: Map<string, Verse>,
  todayISODate: string
): Verse[] {
  const dueVerseIds = new Set<string>();

  for (const collection of collections) {
    for (const verseId of collection.verseIds) {
      const progress = progressByVerseId.get(verseId);
      if (!progress) continue;
      if (progress.nextReviewDate <= todayISODate) {
        dueVerseIds.add(verseId);
      }
    }
  }

  const dueVerses: Verse[] = [];
  for (const verseId of dueVerseIds) {
    const verse = versesById.get(verseId);
    if (verse) dueVerses.push(verse);
  }

  return dueVerses.sort((a, b) => {
    const progressA = progressByVerseId.get(a.id);
    const progressB = progressByVerseId.get(b.id);
    const dateA = progressA?.nextReviewDate ?? '';
    const dateB = progressB?.nextReviewDate ?? '';
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}
