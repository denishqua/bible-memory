// Zero logic in this component, per the plan — it just renders whatever
// practice count it's handed. The caller (App.tsx) owns fetching the Profile.
interface PracticeCountBadgeProps {
  count: number;
}

export function PracticeCountBadge({ count }: PracticeCountBadgeProps) {
  return (
    <span
      title={count === 1 ? "1 verse practiced" : `${count} verses practiced`}
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
  );
}
