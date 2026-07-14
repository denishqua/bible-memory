import { useCallback, useEffect, useState } from "react";
import { useStorage } from "../data/storageContext";
import { createId } from "../data/ids";
import type { Collection, CollectionVerseLink } from "../types/collection";

export function useCollections() {
  const storage = useStorage();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [links, setLinks] = useState<CollectionVerseLink[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [nextCollections, nextLinks] = await Promise.all([
      storage.getCollections(),
      storage.getCollectionLinks(),
    ]);
    setCollections(nextCollections);
    setLinks(nextLinks);
    setLoading(false);
  }, [storage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createCollection = useCallback(
    async (name: string): Promise<Collection> => {
      const collection: Collection = { id: createId(), name, createdAt: new Date().toISOString() };
      await storage.saveCollection(collection);
      await refresh();
      return collection;
    },
    [storage, refresh],
  );

  const deleteCollection = useCallback(
    async (id: string): Promise<void> => {
      await storage.deleteCollection(id);
      await refresh();
    },
    [storage, refresh],
  );

  const renameCollection = useCallback(
    async (id: string, name: string): Promise<void> => {
      // Read the current record from storage rather than the `collections`
      // state, so this callback's identity doesn't churn on every refresh
      // (matching the other mutations) and it never acts on a stale copy.
      const existing = (await storage.getCollections()).find((c) => c.id === id);
      if (!existing) return;
      // saveCollection upserts by id, so this only changes the name.
      await storage.saveCollection({ ...existing, name });
      await refresh();
    },
    [storage, refresh],
  );

  const addVerseToCollection = useCallback(
    async (collectionId: string, verseId: string): Promise<void> => {
      await storage.addVerseToCollection({ collectionId, verseId, addedAt: new Date().toISOString() });
      await refresh();
    },
    [storage, refresh],
  );

  const removeVerseFromCollection = useCallback(
    async (collectionId: string, verseId: string): Promise<void> => {
      await storage.removeVerseFromCollection(collectionId, verseId);
      await refresh();
    },
    [storage, refresh],
  );

  const reorderCollectionVerses = useCallback(
    async (collectionId: string, orderedVerseIds: string[]): Promise<void> => {
      await storage.reorderCollectionVerses(collectionId, orderedVerseIds);
      await refresh();
    },
    [storage, refresh],
  );

  const getVerseIdsForCollection = useCallback(
    // Ordering rule: links with an explicit sortOrder (written by the last
    // reorder) come first, sorted by it; links without one (added later, or in
    // a never-reordered collection) follow, sorted by addedAt ascending. A
    // never-reordered collection therefore keeps pure date-added order.
    // ISO 8601 strings sort correctly lexicographically.
    (collectionId: string): string[] =>
      links
        .filter((link) => link.collectionId === collectionId)
        .sort((a, b) => {
          if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
            return a.sortOrder - b.sortOrder;
          }
          if (a.sortOrder !== undefined) return -1;
          if (b.sortOrder !== undefined) return 1;
          return a.addedAt.localeCompare(b.addedAt);
        })
        .map((link) => link.verseId),
    [links],
  );

  const getCollectionsForVerse = useCallback(
    (verseId: string): Collection[] => {
      const collectionIds = new Set(
        links.filter((link) => link.verseId === verseId).map((link) => link.collectionId),
      );
      return collections.filter((c) => collectionIds.has(c.id));
    },
    [links, collections],
  );

  return {
    collections,
    links,
    loading,
    createCollection,
    deleteCollection,
    renameCollection,
    addVerseToCollection,
    removeVerseFromCollection,
    reorderCollectionVerses,
    getVerseIdsForCollection,
    getCollectionsForVerse,
    refresh,
  };
}
