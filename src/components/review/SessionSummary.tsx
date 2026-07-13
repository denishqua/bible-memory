import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

interface SessionSummaryProps {
  accuracy: number;
  passed: boolean;
  onRetry: () => void;
  // Destination for the "Back to Library" link. null hides the link entirely
  // (the verse gate has its own "Proceed to site" exit instead).
  backTo: string | null;
}

export function SessionSummary({ accuracy, passed, onRetry, backTo }: SessionSummaryProps) {
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
          color: passed ? "var(--color-sage-contrast)" : "var(--color-clay-contrast)",
          background: passed ? "var(--color-sage)" : "var(--color-clay)",
        }}
      >
        {passed ? "Passed" : "Try Again"}
      </span>
      <h2 style={{ marginBottom: "0.25rem" }}>Session Complete</h2>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "2.25rem",
          color: "var(--color-ink)",
          marginBottom: "1.25rem",
        }}
      >
        {accuracy}%
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
