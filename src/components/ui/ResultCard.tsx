import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "./Card";
import { Button } from "./Button";

// Badge coloring by outcome. "pass" and "fail" are the sage/clay pair every
// end screen shares; "danger" is the red variant Verse Defender's *failed*
// screen uses (the verse breached the defenses) — same clay-contrast text, but
// a danger background instead of clay.
const BADGE_COLORS = {
  pass: { color: "var(--color-sage-contrast)", background: "var(--color-sage)" },
  fail: { color: "var(--color-clay-contrast)", background: "var(--color-clay)" },
  danger: { color: "var(--color-clay-contrast)", background: "var(--color-danger)" },
} as const;

interface ResultCardProps {
  // Pill text (e.g. "Defended", "Breached", "Passed", "Try Again").
  badgeLabel: string;
  badgeVariant: keyof typeof BADGE_COLORS;
  // The h2 heading ("Mission Complete" / "Mission Failed" / "Session Complete").
  title: ReactNode;
  // The large serif percentage/headline. Omit to render no headline line — the
  // per-verse breakdown path (SessionSummary) supplies its list via children
  // instead.
  headline?: ReactNode;
  // Sub-line / per-verse body, fully caller-owned markup so each screen keeps
  // its exact text and styling.
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  // "Back to Library" link target. Null/undefined hides the link (the verse
  // gate supplies its own exit).
  backTo?: string | null;
}

// Shared end-of-session card: a centered Card holding a pill badge, a heading,
// an optional large percentage, an optional sub-line/body, and a button row
// (Retry + an optional "Back to Library" link). All four session end screens
// render through this so the shell stays identical; only the genuinely-unique
// bits (badge text/variant, heading, percentage source, sub-line) come in as
// props.
export function ResultCard({
  badgeLabel,
  badgeVariant,
  title,
  headline,
  children,
  onRetry,
  retryLabel = "Retry",
  backTo,
}: ResultCardProps) {
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
          ...BADGE_COLORS[badgeVariant],
        }}
      >
        {badgeLabel}
      </span>
      <h2 style={{ marginBottom: "0.25rem" }}>{title}</h2>
      {headline !== undefined && (
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.25rem",
            color: "var(--color-ink)",
            // When a sub-line follows, sit tight against it (0.5rem); otherwise
            // the headline is the last content before the buttons (1.25rem).
            marginBottom: children ? "0.5rem" : "1.25rem",
          }}
        >
          {headline}
        </p>
      )}
      {children}
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {backTo != null && (
          <Link to={backTo} style={{ textDecoration: "none" }}>
            <Button variant="ghost">Back to Library</Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
