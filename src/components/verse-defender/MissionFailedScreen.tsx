import type { LivesResult } from "../../lib/verseDefenderEngine";
import { getDisplayAccuracy } from "../../types/review";
import { ResultCard } from "../ui/ResultCard";

interface MissionFailedScreenProps {
  result: LivesResult;
  onRetry: () => void;
  maxLives: number; // total shield pool for the run
  // null hides the "Back to Library" link (the verse gate supplies its own exit).
  backTo?: string | null;
}

export function MissionFailedScreen({ result, onRetry, maxLives, backTo = "/" }: MissionFailedScreenProps) {
  return (
    <ResultCard
      badgeLabel="Breached"
      badgeVariant="danger"
      title="Mission Failed"
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
        The verse broke through the defenses. Shields: 0 of {maxLives}
      </p>
    </ResultCard>
  );
}
