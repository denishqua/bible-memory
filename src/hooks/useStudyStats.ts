import { useMemo } from "react";
import { useVerses } from "./useVerses";
import { useCollections } from "./useCollections";
import { useSettings } from "./useSettings";
import { summarizePool, type PoolSummary } from "../lib/srs";

// Resolves the scheduler's verse pool the SAME way StudyTodayPage does (null /
// empty collectionIds → whole library; otherwise the deduped union of the
// selected collections' verses) and summarizes it by SRS phase + due count.
// Backs both the header due badge and the Study Today progress dashboard, so
// they read from one live source (useVerses broadcasts VERSES_UPDATED_EVENT on
// every mutation, keeping this in sync after a study session or schedule edit).
export interface StudyStats extends PoolSummary {
  loading: boolean;
}

export function useStudyStats(): StudyStats {
  const { verses, loading: versesLoading } = useVerses();
  const { getVerseIdsForCollection, loading: collectionsLoading } = useCollections();
  const { settings, loading: settingsLoading } = useSettings();

  const scheduler = settings?.scheduler;

  const poolVerses = useMemo<typeof verses>(() => {
    // null / empty selection → the whole library.
    if (!scheduler || scheduler.collectionIds === null || scheduler.collectionIds.length === 0) {
      return verses;
    }
    const byId = new Map(verses.map((v) => [v.id, v]));
    const seen = new Set<string>();
    const pool: typeof verses = [];
    for (const collectionId of scheduler.collectionIds) {
      for (const id of getVerseIdsForCollection(collectionId)) {
        if (seen.has(id)) continue;
        seen.add(id);
        const verse = byId.get(id);
        if (verse) pool.push(verse);
      }
    }
    return pool;
  }, [scheduler, verses, getVerseIdsForCollection]);

  const loading = versesLoading || collectionsLoading || settingsLoading;

  const summary = useMemo(() => summarizePool(poolVerses, new Date()), [poolVerses]);

  return { ...summary, loading };
}
