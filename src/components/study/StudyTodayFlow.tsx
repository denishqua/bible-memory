import { useCallback, useMemo, useRef, useState } from "react";
import { renderSession } from "../review/renderSession";
import { buildVerseReviewTokens } from "../../lib/verseReview";
import {
  applyReview,
  buildStudyQueue,
  type OnFailBehavior,
  type StudyItem,
} from "../../lib/srs";
import { Button } from "../ui/Button";
import type { Verse } from "../../types/verse";
import type { ReviewScope, ReviewSession } from "../../types/review";

interface StudyTodayFlowProps {
  verses: Verse[];
  sessions: ReviewSession[];
  newPerDay: number;
  poolVerseIds: string[] | null;
  onFailBehavior: OnFailBehavior;
  // From useVerses — writes back srsBucket/dueAt without bumping updatedAt.
  setSrsState: (id: string, srs: { srsBucket: number; dueAt: string }) => Promise<void>;
  onDone?: () => void;
}

// The Study Today session runner. Modeled on RandomReviewFlow: the queue is
// snapshotted ONCE on mount (a lazy useState, stable across re-renders even as
// hooks refresh after each verse logs), and verses are shown one at a time via
// the shared renderSession, keyed by verse.id so the session component fully
// remounts between verses. Unlike RandomReviewFlow there's NO ModePicker — each
// verse's mode is auto-chosen by the scheduler (item.mode).
export function StudyTodayFlow({
  verses,
  sessions,
  newPerDay,
  poolVerseIds,
  onFailBehavior,
  setSrsState,
  onDone,
}: StudyTodayFlowProps) {
  // Snapshot the queue exactly once. `now` is captured inside the initializer so
  // the same instant scopes both the due-check and the interval math for the run.
  const [queue] = useState<StudyItem[]>(() =>
    buildStudyQueue({
      verses,
      sessions,
      newPerDay,
      now: new Date().toISOString(),
      poolVerseIds,
    }),
  );
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  // Hide the reference in the progress line once the player is ~25% through the
  // current verse, so the appended reference can't be read while it's recalled.
  const [hideReference, setHideReference] = useState(false);
  // Verse ids whose SRS transition has already been applied this session. Retry
  // can re-fire onComplete, so the transition must run at most once per verse.
  const processedRef = useRef<Set<string>>(new Set());

  const item = queue[index];
  const verse = item?.verse;
  const isLast = index >= queue.length - 1;

  const tokens = useMemo(
    () => (verse ? buildVerseReviewTokens(verse.text, verse.reference) : []),
    [verse],
  );
  const scope = useMemo<ReviewScope | null>(
    () => (verse ? { type: "verse", verseId: verse.id } : null),
    [verse],
  );

  const handleComplete = useCallback(
    (outcome?: { accuracy: number; passed: boolean }) => {
      if (!verse || !outcome) return;
      if (processedRef.current.has(verse.id)) return;
      processedRef.current.add(verse.id);
      // `passed` drives only the recorded ReviewResult / summary UI (inside
      // ReviewSession, unchanged). The SRS decision uses the raw accuracy so it
      // can apply the gracious three-band model with the configured miss policy.
      const srs = applyReview(verse, outcome.accuracy, new Date().toISOString(), onFailBehavior);
      void setSrsState(verse.id, srs);
    },
    [verse, onFailBehavior, setSrsState],
  );

  if (queue.length === 0) {
    return (
      <p style={{ color: "var(--color-ink-muted)" }}>Nothing to study right now.</p>
    );
  }

  if (finished) {
    return (
      <div>
        <h2 style={{ marginBottom: "0.5rem" }}>Session complete</h2>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.25rem" }}>
          {queue.length} verse{queue.length === 1 ? "" : "s"} studied.
        </p>
        {onDone ? (
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        ) : null}
      </div>
    );
  }

  const advance = () => {
    setHideReference(false);
    if (isLast) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <div>
      <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem", fontSize: "0.95rem" }}>
        Verse {index + 1} of {queue.length}
        {verse && !hideReference ? ` — ${verse.reference}` : ""}
      </p>
      {verse && scope ? (
        // Keyed by verseId so the session component fully unmounts/remounts (and
        // resets its state) between verses.
        <div key={verse.id}>
          {renderSession(
            item.mode,
            scope,
            tokens,
            () => {},
            handleComplete,
            false,
            undefined,
            setHideReference,
          )}
        </div>
      ) : (
        <p style={{ color: "var(--color-ink-muted)" }}>
          This verse is no longer in your library — skip ahead.
        </p>
      )}
      <div style={{ marginTop: "1.25rem" }}>
        <Button variant="ghost" onClick={advance}>
          {isLast ? "Finish" : "Next Verse →"}
        </Button>
      </div>
    </div>
  );
}
