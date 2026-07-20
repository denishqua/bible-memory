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
  // Bulk collection review only: a per-verse accuracy breakdown, in review
  // order. When present it REPLACES the single large overall percentage with a
  // list of "{reference} — {pct}%" rows. Absent → the single-number rendering
  // (single-verse review), unchanged. The Passed/Try Again badge still keys off
  // the overall `accuracy`/`passed` either way.
  perVerse?: { reference: string; accuracy: number }[];
}

export function SessionSummary({ accuracy, passed, onRetry, backTo, perVerse }: SessionSummaryProps) {
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
      {perVerse ? (
        <ul
          style={{
            listStyle: "none",
            margin: "1rem 0 1.25rem",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            textAlign: "left",
          }}
        >
          {perVerse.map((entry, i) => (
            <li
              key={`${entry.reference}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                fontSize: "0.95rem",
                color: "var(--color-ink)",
                borderBottom: "1px solid var(--color-border)",
                paddingBottom: "0.35rem",
              }}
            >
              <span style={{ fontFamily: "var(--font-serif)" }}>{entry.reference}</span>
              <span style={{ fontWeight: 600 }}>{entry.accuracy}%</span>
            </li>
          ))}
        </ul>
      ) : (
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
      )}
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
