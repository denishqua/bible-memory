import { useTheme } from "../../hooks/useTheme";

export function ThemeToggle() {
  const { resolved, cycleTheme } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2.25rem",
        height: "2.25rem",
        borderRadius: "999px",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        color: "var(--color-ink)",
        cursor: "pointer",
        fontSize: "1.1rem",
        lineHeight: 1,
      }}
    >
      <span aria-hidden="true">{isDark ? "\u{1F319}" : "\u{2600}\u{FE0F}"}</span>
    </button>
  );
}
