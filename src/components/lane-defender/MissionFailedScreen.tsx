import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import type { LaneDefenderResult } from "../../lib/laneDefenderEngine";

interface MissionFailedScreenProps {
  result: LaneDefenderResult;
  onRetry: () => void;
}

// Single-verse scope only: lives hit 0 before the queue was cleared.
export function MissionFailedScreen({ result, onRetry }: MissionFailedScreenProps) {
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
          color: "var(--color-clay-contrast)",
          background: "var(--color-clay)",
        }}
      >
        Try Again
      </span>
      <h2 style={{ marginBottom: "0.25rem" }}>Mission Failed</h2>
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
        Out of lives — the verse got through. Take another run at it.
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
