import { useMemo, useState } from "react";
import { renderSession } from "../review/renderSession";
import { buildVerseReviewTokens } from "../../lib/verseReview";
import { buildStudyQueue, type StudyItem } from "../../lib/srs";
import { useSrsAdvance } from "../../hooks/useSrsAdvance";
import { Button } from "../ui/Button";
import type { Verse } from "../../types/verse";
import type { ReviewScope } from "../../types/review";

interface StudyTodayFlowProps {
  verses: Verse[];
  poolVerseIds: string[] | null;
  onDone?: () => void;
}

// The Study Today session runner. Modeled on RandomReviewFlow: the queue is
// snapshotted ONCE on mount (a lazy useState, stable across re-renders even as
// hooks refresh after each verse logs), and verses are shown one at a time via
// the shared renderSession, keyed by verse.id so the session component fully
// remounts between verses. Unlike RandomReviewFlow there's NO ModePicker — each
// verse's mode is auto-chosen by the scheduler (item.mode).
export function StudyTodayFlow({ verses, poolVerseIds, onDone }: StudyTodayFlowProps) {
  // Snapshot the queue exactly once. `now` is captured inside the initializer so
  // the same instant scopes both the due-check and the interval math for the run.
  const [queue] = useState<StudyItem[]>(() =>
    buildStudyQueue({
      verses,
      now: new Date().toISOString(),
      poolVerseIds,
    }),
  );
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  // Hide the reference in the progress line once the player is ~25% through the
  // current verse, so the appended reference can't be read while it's recalled.
  const [hideReference, setHideReference] = useState(false);
  // Advances the current verse's SRS schedule once per verse (guards Retry).
  const { advance: advanceSrs } = useSrsAdvance();

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

  // Advance the current verse's schedule on completion (useSrsAdvance guards
  // against Retry re-firing for the same verse).
  const handleComplete = (outcome?: { accuracy: number; passed: boolean }) => {
    advanceSrs(verse, outcome);
  };

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
