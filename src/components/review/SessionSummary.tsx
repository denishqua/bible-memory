import { ResultCard } from "../ui/ResultCard";

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
    <ResultCard
      badgeLabel={passed ? "Passed" : "Try Again"}
      badgeVariant={passed ? "pass" : "fail"}
      title="Session Complete"
      headline={perVerse ? undefined : `${accuracy}%`}
      onRetry={onRetry}
      backTo={backTo}
    >
      {perVerse && (
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
      )}
    </ResultCard>
  );
}
