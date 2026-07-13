import { MAX_LIVES } from "../../lib/verseDefenderEngine";

interface LivesDisplayProps {
  livesRemaining: number; // already clamped >= 0 by the caller
}

export function LivesDisplay({ livesRemaining }: LivesDisplayProps) {
  return (
    <div
      aria-label={`${livesRemaining} of ${MAX_LIVES} shields remaining`}
      style={{ display: "flex", alignItems: "center", gap: "6px" }}
    >
      <span
        style={{
          fontSize: "0.8rem",
          color: "var(--color-ink-muted)",
          marginRight: "2px",
        }}
      >
        Shields
      </span>
      {Array.from({ length: MAX_LIVES }, (_, index) => {
        const filled = index < livesRemaining;
        return (
          <span
            key={index}
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: filled ? "var(--color-clay)" : "transparent",
              border: filled ? "1.5px solid transparent" : "1.5px solid var(--color-border)",
              boxSizing: "border-box",
              transition: "background-color 0.3s ease",
            }}
          />
        );
      })}
    </div>
  );
}
