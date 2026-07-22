import { useMemo, useState } from "react";
import { renderSession } from "../review/renderSession";
import { VerseRunnerView } from "../review/VerseRunnerView";
import { buildVerseReviewTokens } from "../../lib/verseReview";
import { buildStudyQueue, type StudyItem } from "../../lib/srs";
import { useSrsAdvance } from "../../hooks/useSrsAdvance";
import { useVerseRunner } from "../../hooks/useVerseRunner";
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
  const { index, isLast, finished, hideReference, setHideReference, advance } = useVerseRunner(
    queue.length,
  );
  // Advances the current verse's SRS schedule once per verse (guards Retry).
  const { advance: advanceSrs } = useSrsAdvance();

  const item = queue[index];
  const verse = item?.verse;

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

  const heading = `Verse ${index + 1} of ${queue.length}${
    verse && !hideReference ? ` — ${verse.reference}` : ""
  }`;

  return (
    <VerseRunnerView heading={heading} verseMissing={!verse || !scope} isLast={isLast} onAdvance={advance}>
      {/* Keyed by verseId so the session component fully unmounts/remounts (and
          resets its state) between verses. */}
      {verse && scope ? (
        <div key={verse.id}>
          {renderSession({
            mode: item.mode,
            scope,
            tokens,
            onChangeMode: () => {},
            onComplete: handleComplete,
            onHideReference: setHideReference,
          })}
        </div>
      ) : null}
    </VerseRunnerView>
  );
}
