// Zero logic in this component, per the plan — it just renders whatever
// practice count it's handed. The caller (App.tsx) owns fetching the Profile.
import { Tooltip } from "./Tooltip";

interface PracticeCountBadgeProps {
  count: number;
}

export function PracticeCountBadge({ count }: PracticeCountBadgeProps) {
  return (
    // Opens downward (pinned to the top edge, no room above) and right-anchored
    // so it doesn't spill past the viewport in the header's far-right corner.
    <Tooltip
      label="Verses practiced — the total number of reviews you've completed so far (each finished review, including a whole collection, counts once)."
      placement="bottom"
      align="end"
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          fontSize: "0.9rem",
          fontWeight: 600,
          color: "var(--color-clay)",
        }}
      >
        <span aria-hidden="true">📖</span>
        <span>{count}</span>
      </span>
    </Tooltip>
  );
}
