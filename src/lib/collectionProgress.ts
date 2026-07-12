import type { Collection, VerseProgress } from '../types';

export function collectionMasteredCount(
  collection: Collection,
  progressByVerseId: Map<string, VerseProgress>
): number {
  return collection.verseIds.filter((id) => progressByVerseId.get(id)?.status === 'mastered').length;
}

export function isCollectionComplete(
  collection: Collection,
  progressByVerseId: Map<string, VerseProgress>
): boolean {
  return (
    collection.verseIds.length > 0 &&
    collectionMasteredCount(collection, progressByVerseId) === collection.verseIds.length
  );
}
