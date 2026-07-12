// Zero logic in this component, per the plan — it just renders whatever
// streak count it's handed. The caller (App.tsx) owns fetching the Profile.
interface FlameStreakBadgeProps {
  streak: number;
}

export function FlameStreakBadge({ streak }: FlameStreakBadgeProps) {
  return (
    <span
      title={streak === 1 ? "1 day streak" : `${streak} day streak`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        fontSize: "0.9rem",
        fontWeight: 600,
        color: "var(--color-clay)",
      }}
    >
      <span aria-hidden="true">🔥</span>
      <span>{streak}</span>
    </span>
  );
}
