import { useCallback, useMemo, useState } from "react";
import { useVerses } from "../hooks/useVerses";
import { useReviewHistory } from "../hooks/useReviewHistory";
import { useSettings } from "../hooks/useSettings";
import { useCollections } from "../hooks/useCollections";
import { computeVerseScores } from "../lib/verseScore";
import { buildStudyQueue } from "../lib/srs";
import { StudyTodayFlow } from "../components/study/StudyTodayFlow";
import { VerseList } from "../components/library/VerseList";
import { AddToCollectionDialog } from "../components/library/AddToCollectionDialog";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { Verse } from "../types/verse";

export function StudyTodayPage() {
  const { verses, loading: versesLoading, deleteVerse, refresh: refreshVerses } = useVerses();
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useReviewHistory();
  const { settings, loading: settingsLoading } = useSettings();
  const { loading: collectionsLoading, unionVerseIds } = useCollections();

  const [started, setStarted] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState<Verse | null>(null);

  const loading = versesLoading || sessionsLoading || settingsLoading || collectionsLoading;
  const scheduler = settings?.scheduler;

  const poolVerseIds = useMemo<string[] | null>(() => {
    if (!scheduler || scheduler.collectionIds === null) return null;
    return unionVerseIds(scheduler.collectionIds);
  }, [scheduler, unionVerseIds]);

  const dueVerses = useMemo(
    () =>
      buildStudyQueue({ verses, now: new Date().toISOString(), poolVerseIds }).map(
        (item) => item.verse,
      ),
    [verses, poolVerseIds],
  );

  const scores = useMemo(() => computeVerseScores(sessions), [sessions]);

  const handleFlowDone = useCallback(() => {
    void refreshVerses();
    void refreshSessions();
    setStarted(false);
  }, [refreshVerses, refreshSessions]);

  const handleAddToCollection = useCallback((verse: Verse) => {
    setAddingToCollection(verse);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setAddingToCollection(null);
  }, []);

  if (loading || !scheduler) {
    return (
      <div>
        <h1 style={{ marginBottom: "1.5rem" }}>Study Today</h1>
        <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (started) {
    return (
      <div>
        <h1 style={{ marginBottom: "1.5rem" }}>Study Today</h1>
        <StudyTodayFlow
          verses={verses}
          poolVerseIds={poolVerseIds}
          onDone={handleFlowDone}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <h1>Study Today</h1>
        {dueVerses.length > 0 ? (
          <Button variant="primary" onClick={() => setStarted(true)}>
            Review all ({dueVerses.length})
          </Button>
        ) : null}
      </div>

      {dueVerses.length === 0 ? (
        <Card>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.4rem" }}>All caught up</h2>
          <p style={{ color: "var(--color-ink-muted)" }}>
            Nothing is due for review right now. Review a verse from your Library to start
            learning it — it'll join your schedule and come back here when it's due.
          </p>
        </Card>
      ) : (
        <VerseList
          verses={dueVerses}
          scores={scores}
          onDelete={deleteVerse}
          onAddToCollection={handleAddToCollection}
        />
      )}

      {addingToCollection ? (
        <AddToCollectionDialog
          verseId={addingToCollection.id}
          verseReference={addingToCollection.reference}
          onClose={handleCloseDialog}
        />
      ) : null}
    </div>
  );
}

