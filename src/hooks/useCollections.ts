import { useCallback, useEffect, useState } from "react";
import { useStorage } from "./useStorage";
import { createId } from "../data/ids";
import type { Collection, CollectionVerseLink } from "../types/collection";
import { resolveCollectionVerseIds } from "../lib/collectionReview";

export const COLLECTIONS_UPDATED_EVENT = "bm:collections-updated";

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

  useEffect(() => {
    const handleExternalUpdate = () => {
      refresh();
    };
    window.addEventListener(COLLECTIONS_UPDATED_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(COLLECTIONS_UPDATED_EVENT, handleExternalUpdate);
  }, [refresh]);

  const createCollection = useCallback(
    async (name: string): Promise<Collection> => {
      const collection: Collection = { id: createId(), name, createdAt: new Date().toISOString() };
      await storage.saveCollection(collection);
      await refresh();
      window.dispatchEvent(new Event(COLLECTIONS_UPDATED_EVENT));
      return collection;
    },
    [storage, refresh],
  );

  const deleteCollection = useCallback(
    async (id: string): Promise<void> => {
      await storage.deleteCollection(id);
      await refresh();
      window.dispatchEvent(new Event(COLLECTIONS_UPDATED_EVENT));
    },
    [storage, refresh],
  );

  const renameCollection = useCallback(
    async (id: string, name: string): Promise<void> => {
      const existing = (await storage.getCollections()).find((c) => c.id === id);
      if (!existing) return;
      await storage.saveCollection({ ...existing, name });
      await refresh();
      window.dispatchEvent(new Event(COLLECTIONS_UPDATED_EVENT));
    },
    [storage, refresh],
  );

  const addVerseToCollection = useCallback(
    async (collectionId: string, verseId: string): Promise<void> => {
      await storage.addVerseToCollection({ collectionId, verseId, addedAt: new Date().toISOString() });
      await refresh();
      window.dispatchEvent(new Event(COLLECTIONS_UPDATED_EVENT));
    },
    [storage, refresh],
  );

  const removeVerseFromCollection = useCallback(
    async (collectionId: string, verseId: string): Promise<void> => {
      await storage.removeVerseFromCollection(collectionId, verseId);
      await refresh();
      window.dispatchEvent(new Event(COLLECTIONS_UPDATED_EVENT));
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

