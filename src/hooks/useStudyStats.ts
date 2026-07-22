import { useMemo } from "react";
import { useVerses } from "./useVerses";
import { useCollections } from "./useCollections";
import { useSettings } from "./useSettings";
import { summarizePool, type PoolSummary } from "../lib/srs";
import { resolveCollectionVerseIds, resolveCollectionVerses } from "../lib/collectionReview";

// Resolves the scheduler's verse pool the SAME way StudyTodayPage does (null /
// empty collectionIds → whole library; otherwise the deduped union of the
// selected collections' verses) and summarizes it by SRS phase + due count.
// Backs both the header due badge and the Study Today progress dashboard, so
// they read from one live source (useVerses broadcasts VERSES_UPDATED_EVENT on
// every mutation, keeping this in sync after a study session or schedule edit).
interface StudyStats extends PoolSummary {
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
    const verseIds = resolveCollectionVerseIds(scheduler.collectionIds, getVerseIdsForCollection);
    return resolveCollectionVerses(verseIds, verses);
  }, [scheduler, verses, getVerseIdsForCollection]);

  const loading = versesLoading || collectionsLoading || settingsLoading;

  const summary = useMemo(() => summarizePool(poolVerses, new Date()), [poolVerses]);

  return { ...summary, loading };
}
