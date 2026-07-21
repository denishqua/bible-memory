import type { LivesResult } from "../../lib/verseDefenderEngine";
import { getDisplayAccuracy } from "../../types/review";
import { ResultCard } from "../ui/ResultCard";

interface MissionCompleteScreenProps {
  result: LivesResult;
  onRetry: () => void;
  maxLives: number; // total shield pool for the run
  // null hides the "Back to Library" link (the verse gate supplies its own exit).
  backTo?: string | null;
}

export function MissionCompleteScreen({ result, onRetry, maxLives, backTo = "/" }: MissionCompleteScreenProps) {
  return (
    <ResultCard
      badgeLabel={result.passed ? "Defended" : "Survived"}
      badgeVariant={result.passed ? "pass" : "fail"}
      title="Mission Complete"
      headline={`${getDisplayAccuracy(result)}%`}
      onRetry={onRetry}
      backTo={backTo}
    >
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--color-ink-muted)",
          marginBottom: "1.25rem",
        }}
      >
        Shields left: {result.livesRemaining} of {maxLives}
      </p>
    </ResultCard>
  );
}
