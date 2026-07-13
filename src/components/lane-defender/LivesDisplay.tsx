import { STARTING_LIVES } from "../../lib/laneDefenderEngine";

interface LivesDisplayProps {
  livesRemaining: number;
}

// Simple pip row — filled clay dots for remaining lives, hollow for spent
// ones. Self-contained to this mode on purpose (no sharing with other arcade
// modes' displays).
export function LivesDisplay({ livesRemaining }: LivesDisplayProps) {
  const clamped = Math.max(0, Math.min(STARTING_LIVES, livesRemaining));

  return (
    <span
      role="img"
      aria-label={`Lives: ${clamped} of ${STARTING_LIVES}`}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
    >
      {Array.from({ length: STARTING_LIVES }, (_, i) => {
        const alive = i < clamped;
        return (
          <span
            key={i}
            style={{
              width: "0.7rem",
              height: "0.7rem",
              borderRadius: "50%",
              background: alive ? "var(--color-clay)" : "transparent",
              border: alive ? "1px solid transparent" : "1px solid var(--color-border)",
              transition: "background 0.15s ease",
            }}
          />
        );
      })}
    </span>
  );
}
