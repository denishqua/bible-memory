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

  return { collections, collectionsById, loading, refresh };
}
