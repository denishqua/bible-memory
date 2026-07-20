import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ModePicker } from "./ModePicker";
import { renderSession } from "./renderSession";
import { tokenize } from "../../lib/tokenize";
import { Button } from "../ui/Button";
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
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  // True while the current verse's "type the reference" recall step is active —
  // hide the reference in the progress line so it can't be read while recalling.
  const [referenceStep, setReferenceStep] = useState(false);

  const versesById = useMemo(() => new Map(verses.map((v) => [v.id, v] as const)), [verses]);

  const currentVerseId = shuffledIds[index];
  const verse = currentVerseId ? versesById.get(currentVerseId) : undefined;
  const isLast = index >= shuffledIds.length - 1;

  const tokens = useMemo(() => (verse ? tokenize(verse.text) : []), [verse]);
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

  const advance = () => {
    if (isLast) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (mode === null) {
    return <ModePicker onSelect={setMode} />;
  }

  return (
    <div>
      <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem", fontSize: "0.95rem" }}>
        Verse {index + 1} of {shuffledIds.length}
        {verse && !referenceStep ? ` — ${verse.reference}` : ""}
      </p>
      {verse && scope ? (
        // Keyed by verseId so the session component fully unmounts/remounts
        // (and resets its state) between verses.
        <div key={verse.id}>
          {renderSession(
            mode,
            scope,
            tokens,
            () => setMode(null),
            undefined,
            false,
            undefined,
            verse.reference,
            setReferenceStep,
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
