import { useCallback, useEffect, useState } from 'react';
import type { Collection } from '../types';
import { collectionStore } from '../stores';

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await collectionStore.getAllCollections();
    setCollections(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const collectionsById = new Map(collections.map((c) => [c.id, c]));

  const addCollection = useCallback(
    async (collection: Collection) => {
      await collectionStore.addCollection(collection);
      await refresh();
    },
    [refresh]
  );

  const updateCollection = useCallback(
    async (id: string, patch: Partial<Collection>) => {
      await collectionStore.updateCollection(id, patch);
      await refresh();
    },
    [refresh]
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      await collectionStore.deleteCollection(id);
      await refresh();
    },
    [refresh]
  );

  return { collections, collectionsById, loading, refresh, addCollection, updateCollection, deleteCollection };
}
