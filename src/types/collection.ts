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
}
