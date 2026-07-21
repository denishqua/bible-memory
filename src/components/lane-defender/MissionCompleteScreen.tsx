import { ResultCard } from "../ui/ResultCard";
import type { LaneDefenderResult } from "../../lib/laneDefenderEngine";

interface MissionCompleteScreenProps {
  result: LaneDefenderResult;
  onRetry: () => void;
  // null hides the "Back to Library" link (the verse gate supplies its own exit).
  backTo?: string | null;
}

// Every word in the queue was destroyed. The percentage is the per-word
// clean-shot score, so a run can complete below the pass bar (fumbles /
// dropped targets along the way); the badge reflects `result.passed`.
export function MissionCompleteScreen({ result, onRetry, backTo = "/" }: MissionCompleteScreenProps) {
  return (
    <ResultCard
      badgeLabel={result.passed ? "Passed" : "Try Again"}
      badgeVariant={result.passed ? "pass" : "fail"}
      title="Mission Complete"
      headline={`${result.accuracy}%`}
      onRetry={onRetry}
      backTo={backTo}
    >
      <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
        {result.cleanWords} of {result.totalWords} words shot cleanly.
      </p>
    </ResultCard>
  );
}
