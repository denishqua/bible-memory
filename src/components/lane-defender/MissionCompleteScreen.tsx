import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import type { LaneDefenderResult } from "../../lib/laneDefenderEngine";

interface MissionCompleteScreenProps {
  result: LaneDefenderResult;
  onRetry: () => void;
}

// Every word in the queue was destroyed. A collection run can still complete
// without passing (lives bottomed out on some verse along the way), so the
// badge reflects `result.passed`, not completion itself.
export function MissionCompleteScreen({ result, onRetry }: MissionCompleteScreenProps) {
  const accuracy =
    result.totalKeystrokes === 0
      ? 100
      : Math.round((result.correctKeystrokes / result.totalKeystrokes) * 100);

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
        {accuracy}%
      </p>
      <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
        {result.passed
          ? `Every word shot down with ${result.livesRemaining} ${
              result.livesRemaining === 1 ? "life" : "lives"
            } to spare.`
          : "You made it to the end, but ran out of lives along the way."}
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
        <Button variant="primary" onClick={onRetry}>
          Retry
        </Button>
        <Link to="/" style={{ textDecoration: "none" }}>
          <Button variant="ghost">Back to Library</Button>
        </Link>
      </div>
    </Card>
  );
}
