import { useCallback, useEffect, useState } from 'react';
import type { VerseProgress } from '../types';
import { progressStore } from '../stores';

export function useProgress() {
  const [progressByVerseId, setProgressByVerseId] = useState<Map<string, VerseProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await progressStore.getAllProgress();
    setProgressByVerseId(new Map(all.map((p) => [p.verseId, p])));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { progressByVerseId, loading, refresh };
}
