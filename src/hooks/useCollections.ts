import { useCallback, useEffect, useState } from "react";
import { useStorage } from "./useStorage";
import { createId } from "../data/ids";
import type { Collection, CollectionVerseLink } from "../types/collection";
import { resolveCollectionVerseIds } from "../lib/collectionReview";

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

  const getVerseIdsForCollection = useCallback(
    (collectionId: string): string[] =>
      links
        .filter((link) => link.collectionId === collectionId)
        .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
        .map((link) => link.verseId),
    [links],
  );

  const unionVerseIds = useCallback(
    (collectionIds: string[]): string[] =>
      resolveCollectionVerseIds(collectionIds, getVerseIdsForCollection),
    [getVerseIdsForCollection],
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
    getVerseIdsForCollection,
    unionVerseIds,
    getCollectionsForVerse,
    refresh,
  };
}
