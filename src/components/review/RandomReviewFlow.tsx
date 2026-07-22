import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ModePicker } from "./ModePicker";
import { renderSession } from "./renderSession";
import { VerseRunnerView } from "./VerseRunnerView";
import { buildVerseReviewTokens } from "../../lib/verseReview";
import { useVerseRunner } from "../../hooks/useVerseRunner";
import type { Verse } from "../../types/verse";
import type { Collection } from "../../types/collection";
import type { ReviewMode, ReviewScope } from "../../types/review";

// Fisher–Yates. Plain Math.random is fine here — the shuffle only decides
// review order, nothing security- or fairness-critical.
function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

interface RandomReviewFlowProps {
  collection: Collection;
  // Already filtered to the user's selection, in collection order.
  verses: Verse[];
}

// One verse at a time, in an order shuffled ONCE on mount. The mode is picked
// once up front and applies to every verse in the run. Each verse renders the
// existing session component with a per-verse scope, so session records and
// practice-count updates flow through the components' built-in plumbing
// untouched (each verse is its own session → +1 each).
export function RandomReviewFlow({ collection, verses }: RandomReviewFlowProps) {
  // Lazy initializer: shuffled exactly once, stable across re-renders even if
  // the verses prop identity changes (e.g. a hook refresh after a session logs).
  const [shuffledIds] = useState<string[]>(() => shuffle(verses.map((v) => v.id)));
  const [mode, setMode] = useState<ReviewMode | null>(null);
  const { index, isLast, finished, hideReference, setHideReference, advance } = useVerseRunner(
    shuffledIds.length,
  );

  const versesById = useMemo(() => new Map(verses.map((v) => [v.id, v] as const)), [verses]);

  const currentVerseId = shuffledIds[index];
  const verse = currentVerseId ? versesById.get(currentVerseId) : undefined;

  const tokens = useMemo(
    () => (verse && mode ? buildVerseReviewTokens(verse.text, verse.reference, mode) : []),
    [verse, mode],
  );
  const scope = useMemo<ReviewScope | null>(
    () => (verse ? { type: "verse", verseId: verse.id } : null),
    [verse],
  );

  if (shuffledIds.length === 0) {
    return (
      <div>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem" }}>
          No verses to review.
        </p>
        <Link to={`/collections/${collection.id}`}>Back to {collection.name}</Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div>
        <h2 style={{ marginBottom: "0.5rem" }}>Random review complete</h2>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.25rem" }}>
          {shuffledIds.length} verse{shuffledIds.length === 1 ? "" : "s"} reviewed.
        </p>
        <Link to={`/collections/${collection.id}`}>Back to {collection.name}</Link>
      </div>
    );
  }

  if (mode === null) {
    return <ModePicker onSelect={setMode} />;
  }

  const showReference = verse && !hideReference && mode !== "reference-it";
  const heading = `Verse ${index + 1} of ${shuffledIds.length}${
    showReference ? ` — ${verse.reference}` : ""
  }`;

  return (
    <VerseRunnerView heading={heading} verseMissing={!verse || !scope} isLast={isLast} onAdvance={advance}>
      {/* Keyed by verseId so the session component fully unmounts/remounts
          (and resets its state) between verses. */}
      {verse && scope ? (
        <div key={verse.id}>
          {renderSession({
            mode,
            scope,
            tokens,
            onChangeMode: () => setMode(null),
            onHideReference: setHideReference,
          })}
        </div>
      ) : null}
    </VerseRunnerView>
  );
}
