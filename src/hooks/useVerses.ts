import { useCallback, useEffect, useState } from 'react';
import type { Verse } from '../types';
import { verseStore, progressStore } from '../stores';
import { createInitialProgress } from '../lib/srs';

export function useVerses() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await verseStore.getAllVerses();
    setVerses(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const versesById = new Map(verses.map((v) => [v.id, v]));

  const addVerse = useCallback(
    async (verse: Verse) => {
      await verseStore.addVerse(verse);
      await progressStore.upsertProgress(createInitialProgress(verse.id, new Date()));
      await refresh();
    },
    [refresh]
  );

  return { verses, versesById, loading, refresh, addVerse };
}
