import type { ReactNode } from "react";
import type { DescentPhase } from "../../lib/verseDefenderEngine";

export const FIELD_HEIGHT = 420;
export const ASTEROID_HEIGHT = 88;
export const CANNON_ZONE_HEIGHT = 72; // vertical space reserved at the bottom for the Cannon

interface AsteroidFieldProps {
  phase: DescentPhase;
  children: ReactNode;
}

export function AsteroidField({ phase, children }: AsteroidFieldProps) {
  const inCrisis = phase === "crisis";

  return (
    <div
      style={{
        position: "relative",
        height: `${FIELD_HEIGHT}px`,
        overflow: "hidden",
        borderRadius: "0.9rem",
        border: `1px solid ${inCrisis ? "var(--color-danger)" : "var(--color-border)"}`,
        background: "linear-gradient(to bottom, var(--color-bg), var(--color-surface))",
        boxShadow: inCrisis
          ? "inset 0 0 32px color-mix(in srgb, var(--color-danger) 22%, transparent)"
          : "inset 0 0 0 transparent",
        transition: "border-color 0.4s ease, box-shadow 0.4s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: `${CANNON_ZONE_HEIGHT}px`,
          height: "2px",
          background: "var(--color-border)",
        }}
      />
      {children}
    </div>
  );
}
