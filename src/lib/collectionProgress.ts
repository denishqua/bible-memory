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

export function isCollectionUnlocked(
  collection: Collection,
  collectionsById: Map<string, Collection>,
  progressByVerseId: Map<string, VerseProgress>,
  profileLevel: number
): boolean {
  const rule = collection.unlockRule;
  if (rule.type === 'always') return true;
  if (rule.type === 'requiresLevel') return profileLevel >= rule.requiredLevel;
  const required = collectionsById.get(rule.requiredCollectionId);
  return required ? isCollectionComplete(required, progressByVerseId) : true;
}
