import { useMemo, useState } from "react";
import { useVerses } from "../hooks/useVerses";
import { useReviewHistory } from "../hooks/useReviewHistory";
import { useSettings } from "../hooks/useSettings";
import { useCollections } from "../hooks/useCollections";
import { computeStudyCounts } from "../lib/srs";
import { StudyTodayFlow } from "../components/study/StudyTodayFlow";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function StudyTodayPage() {
  const { verses, loading: versesLoading, setSrsState, refresh: refreshVerses } = useVerses();
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useReviewHistory();
  const { settings, loading: settingsLoading } = useSettings();
  const {
    loading: collectionsLoading,
    getVerseIdsForCollection,
  } = useCollections();

  const [started, setStarted] = useState(false);

  const loading = versesLoading || sessionsLoading || settingsLoading || collectionsLoading;
  const scheduler = settings?.scheduler;

  // Resolve the study pool from the scheduler's collection selection: null means
  // the whole library; otherwise the deduped union of the selected collections'
  // verse ids.
  const poolVerseIds = useMemo<string[] | null>(() => {
    if (!scheduler || scheduler.collectionIds === null) return null;
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const collectionId of scheduler.collectionIds) {
      for (const id of getVerseIdsForCollection(collectionId)) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [scheduler, getVerseIdsForCollection]);

  const counts = useMemo(() => {
    if (!scheduler) return null;
    return computeStudyCounts({
      verses,
      sessions,
      newPerDay: scheduler.newVersesPerDay,
      now: new Date().toISOString(),
      poolVerseIds,
    });
  }, [verses, sessions, scheduler, poolVerseIds]);

  if (loading || !scheduler || !counts) {
    return (
      <div>
        <h1 style={{ marginBottom: "1.5rem" }}>Study Today</h1>
        <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>
      </div>
    );
  }

  const total = counts.dueCount + counts.newAvailable + counts.learningCount;

  if (started) {
    return (
      <div>
        <h1 style={{ marginBottom: "1.5rem" }}>Study Today</h1>
        <StudyTodayFlow
          verses={verses}
          sessions={sessions}
          newPerDay={scheduler.newVersesPerDay}
          poolVerseIds={poolVerseIds}
          onFailBehavior={scheduler.onFailBehavior}
          setSrsState={setSrsState}
          onDone={() => {
            // Reload the underlying data so the landing summary reflects the
            // verses just reviewed, then return to it.
            void refreshVerses();
            void refreshSessions();
            setStarted(false);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem" }}>Study Today</h1>
      {total === 0 ? (
        <Card>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.4rem" }}>All caught up</h2>
          <p style={{ color: "var(--color-ink-muted)" }}>
            Nothing is due for review and you've hit today's new-verse limit. Come back later, or
            add more verses to your library.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.6rem" }}>Ready to study</h2>
          <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.1rem", lineHeight: 1.6 }}>
            {counts.dueCount} due · {counts.newAvailable} new to learn today · {counts.learningCount}{" "}
            in progress
          </p>
          <Button variant="primary" onClick={() => setStarted(true)}>
            Start
          </Button>
        </Card>
      )}
    </div>
  );
}
