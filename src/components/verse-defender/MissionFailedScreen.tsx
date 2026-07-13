import { Link } from "react-router-dom";
import type { LivesResult } from "../../lib/verseDefenderEngine";
import { MAX_LIVES } from "../../lib/verseDefenderEngine";
import { getDisplayAccuracy } from "../../types/review";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

interface MissionFailedScreenProps {
  result: LivesResult;
  onRetry: () => void;
  // null hides the "Back to Library" link (the verse gate supplies its own exit).
  backTo?: string | null;
}

export function MissionFailedScreen({ result, onRetry, backTo = "/" }: MissionFailedScreenProps) {
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
          background: "var(--color-danger)",
        }}
      >
        Breached
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
        {getDisplayAccuracy(result)}%
      </p>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--color-ink-muted)",
          marginBottom: "1.25rem",
        }}
      >
        The verse broke through the defenses. Shields: 0 of {MAX_LIVES}
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
