// Zero logic — renders whatever due count it's handed (the caller owns fetching
// it via useStudyStats). Mirrors PracticeCountBadge's clay accent, but sits
// inline right after the Study nav link so it reads like "Study ③". Hidden
// entirely when nothing is due.
import { Tooltip } from "./Tooltip";

interface DueBadgeProps {
  count: number;
}

export function DueBadge({ count }: DueBadgeProps) {
  if (count <= 0) return null;

  const label = `${count} verse${count === 1 ? "" : "s"} due for review`;

  return (
    <Tooltip label={label} placement="bottom" align="center">
      <span
        aria-label={label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "1.25rem",
          height: "1.25rem",
          padding: "0 0.35rem",
          borderRadius: "999px",
          fontSize: "0.75rem",
          fontWeight: 700,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          color: "var(--color-clay-contrast)",
          background: "var(--color-clay)",
        }}
      >
        {count}
      </span>
    </Tooltip>
  );
}
