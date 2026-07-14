import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
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
    <Card style={{ marginTop: "1.5rem", textAlign: "center" }}>
      <span
        style={{
          display: "inline-block",
          padding: "0.25rem 0.75rem",
          borderRadius: "999px",
          fontSize: "0.8rem",
          fontWeight: 600,
          marginBottom: "0.75rem",
          color: result.passed ? "var(--color-sage-contrast)" : "var(--color-clay-contrast)",
          background: result.passed ? "var(--color-sage)" : "var(--color-clay)",
        }}
      >
        {result.passed ? "Passed" : "Try Again"}
      </span>
      <h2 style={{ marginBottom: "0.25rem" }}>Mission Complete</h2>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "2.25rem",
          color: "var(--color-ink)",
          marginBottom: "0.5rem",
        }}
      >
        {result.accuracy}%
      </p>
      <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
        {result.cleanWords} of {result.totalWords} words shot cleanly.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
        <Button variant="primary" onClick={onRetry}>
          Retry
        </Button>
        {backTo !== null && (
          <Link to={backTo} style={{ textDecoration: "none" }}>
            <Button variant="ghost">Back to Library</Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
