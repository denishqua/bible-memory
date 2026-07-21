import { FIELD_HEIGHT, ASTEROID_HEIGHT, CANNON_ZONE_HEIGHT, CANNON_TIP_Y } from "./AsteroidField";

interface LaserBeamProps {
  /** Descent progress of the asteroid at the moment it was destroyed. */
  hitProgress: number;
}

// Transient one-shot effect: a vertical beam from the cannon tip to the
// destroyed asteroid plus an impact burst at the asteroid's position. The
// parent mounts one per hit (keyed by hit id) and unmounts it after the CSS
// animation finishes — no state in here.
export function LaserBeam({ hitProgress }: LaserBeamProps) {
  const asteroidTop = hitProgress * (FIELD_HEIGHT - ASTEROID_HEIGHT - CANNON_ZONE_HEIGHT);
  const impactY = asteroidTop + ASTEROID_HEIGHT / 2;
  const beamHeight = Math.max(0, CANNON_TIP_Y - impactY);

  return (
    <>
      <div
        className="laser-beam"
        style={{
          position: "absolute",
          left: "50%",
          top: `${impactY}px`,
          height: `${beamHeight}px`,
          width: "4px",
          transformOrigin: "center bottom",
          borderRadius: "2px",
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--color-clay) 55%, transparent), var(--color-clay))",
          boxShadow: "0 0 10px color-mix(in srgb, var(--color-clay) 60%, transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        className="laser-burst"
        style={{
          position: "absolute",
          left: "50%",
          top: `${impactY}px`,
          width: "72px",
          height: "72px",
          borderRadius: "50%",
          border: "3px solid var(--color-clay)",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-clay) 45%, transparent) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}
