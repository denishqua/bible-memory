// A compact, reusable display of a verse's SRS review schedule: the due status
// (primary) with the review frequency as muted secondary context. Both pieces
// are always visible inline, and a Tooltip spells the whole thing out. All date
// math lives in the pure helpers in lib/srs — this component just renders.
import type { Verse } from "../../types/verse";
import { daysUntilDue, dueLabel, frequencyLabel } from "../../lib/srs";
import { Tooltip } from "./Tooltip";

interface ReviewScheduleBadgeProps {
  verse: Verse;
  // Defaults to the current time; injectable for deterministic rendering/tests.
  now?: Date;
}

export function ReviewScheduleBadge({ verse, now = new Date() }: ReviewScheduleBadgeProps) {
  const scheduled = verse.srsBucket !== undefined;
  const days = daysUntilDue(verse, now);
  const due = dueLabel(verse, now);
  const frequency = frequencyLabel(verse);

  const tooltipLabel = scheduled
    ? `Reviewed ${frequency === "Daily" ? "daily" : `every ${frequency.replace("Every ", "").replace("d", " days")}`} · ${
        days !== null && days <= 0 ? "due now" : `due in ${days} day${days === 1 ? "" : "s"}`
      }`
    : "Not scheduled for review yet";

  // Overdue/due-now reads with emphasis; a not-yet-scheduled (New) verse is fully muted.
  const primaryColor = !scheduled
    ? "var(--color-ink-muted)"
    : days !== null && days <= 0
      ? "var(--color-clay)"
      : "var(--color-ink)";

  return (
    <Tooltip label={tooltipLabel} placement="top" align="end" focusable={false}>
      <span
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "flex-end",
          lineHeight: 1.2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: primaryColor,
            whiteSpace: "nowrap",
          }}
        >
          {scheduled ? due : "New"}
        </span>
        <span
          style={{
            fontSize: "0.68rem",
            color: "var(--color-ink-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {scheduled ? frequency : "Not scheduled"}
        </span>
      </span>
    </Tooltip>
  );
}
