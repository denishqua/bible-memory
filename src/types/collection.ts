export interface Collection {
  id: string;
  name: string;
  createdAt: string;
}

// Two flat arrays, not Collection.verseIds[] — deleting a collection is just
// filtering links, which trivially satisfies "verses survive collection deletion."
export interface CollectionVerseLink {
  collectionId: string;
  verseId: string;
  addedAt: string;
  // Explicit position within the collection, written by
  // StorageAdapter.reorderCollectionVerses. Optional: links created after the
  // last reorder (or in never-reordered collections) have none and sort by
  // addedAt AFTER all explicitly-ordered links.
  sortOrder?: number;
}
