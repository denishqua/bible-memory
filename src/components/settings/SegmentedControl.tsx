// Small inline segmented control (used for the theme picker and the gate
// On/Off toggle) — one active segment, radio-group-like.
export function SegmentedControl<T extends string | boolean>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        border: "1px solid var(--color-border)",
        borderRadius: "0.6rem",
        overflow: "hidden",
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            style={{
              padding: "0.5rem 1.1rem",
              fontSize: "0.9rem",
              fontWeight: active ? 600 : 500,
              border: "none",
              cursor: "pointer",
              background: active ? "var(--color-clay)" : "transparent",
              color: active ? "var(--color-clay-contrast)" : "var(--color-ink-muted)",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
