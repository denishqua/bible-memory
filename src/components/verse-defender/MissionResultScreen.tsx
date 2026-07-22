import type { LivesResult } from "../../lib/verseDefenderEngine";
import { getDisplayAccuracy } from "../../types/review";
import { ResultCard } from "../ui/ResultCard";

interface MissionResultScreenProps {
  result: LivesResult;
  onRetry: () => void;
  maxLives: number; // total shield pool for the run
  // The verse breached the defenses (single-verse scope only ever fails this
  // way). Collection scope always "completes" — passed just reflects accuracy.
  failed: boolean;
  // null hides the "Back to Library" link (the verse gate supplies its own exit).
  backTo?: string | null;
}

export function MissionResultScreen({
  result,
  onRetry,
  maxLives,
  failed,
  backTo = "/",
}: MissionResultScreenProps) {
  return (
    <ResultCard
      badgeLabel={failed ? "Breached" : result.passed ? "Defended" : "Survived"}
      badgeVariant={failed ? "danger" : result.passed ? "pass" : "fail"}
      title={failed ? "Mission Failed" : "Mission Complete"}
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
        {failed
          ? `The verse broke through the defenses. Shields: 0 of ${maxLives}`
          : `Shields left: ${result.livesRemaining} of ${maxLives}`}
      </p>
    </ResultCard>
  );
}
