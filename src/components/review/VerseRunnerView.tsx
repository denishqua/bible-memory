import type { ReactNode } from "react";
import { Button } from "../ui/Button";

interface VerseRunnerViewProps {
  // Progress heading, e.g. "Verse 2 of 5 — John 3:16" (the caller decides
  // whether/how to append the reference).
  heading: string;
  // True when the current verse is no longer in the library — shows a skip-ahead
  // note instead of the session.
  verseMissing: boolean;
  isLast: boolean;
  onAdvance: () => void;
  // The keyed session element (owned by the caller so each flow keeps its own
  // per-verse keying/memoization).
  children: ReactNode;
}

// The shared per-verse chrome for the one-verse-at-a-time flows: the progress
// heading, the missing-verse fallback, and the Next/Finish button. Flow-specific
// concerns (mode picking, SRS advance, finished/empty screens) stay in each flow.
export function VerseRunnerView({
  heading,
  verseMissing,
  isLast,
  onAdvance,
  children,
}: VerseRunnerViewProps) {
  return (
    <div>
      <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem", fontSize: "0.95rem" }}>
        {heading}
      </p>
      {verseMissing ? (
        <p style={{ color: "var(--color-ink-muted)" }}>
          This verse is no longer in your library — skip ahead.
        </p>
      ) : (
        children
      )}
      <div style={{ marginTop: "1.25rem" }}>
        <Button variant="ghost" onClick={onAdvance}>
          {isLast ? "Finish" : "Next Verse →"}
        </Button>
      </div>
    </div>
  );
}
