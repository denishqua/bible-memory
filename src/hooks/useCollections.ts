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

  const getVerseIdsForCollection = useCallback(
    // Sorted by addedAt ascending (date-added order) — bulk review plays
    // through a collection in this order, and it's a sane default for the
    // detail-page list too. ISO 8601 strings sort correctly lexicographically.
    (collectionId: string): string[] =>
      links
        .filter((link) => link.collectionId === collectionId)
        .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
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
    addVerseToCollection,
    removeVerseFromCollection,
    getVerseIdsForCollection,
    getCollectionsForVerse,
    refresh,
  };
}
