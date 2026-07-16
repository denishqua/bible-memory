import { FIELD_HEIGHT } from "./AsteroidField";

// Cannon barrel tip sits ~54px above the field bottom (8px inset + 20px mount
// + 26px barrel — see Cannon.tsx), matching LaserBeam.
const CANNON_TIP_Y = FIELD_HEIGHT - 54;

// How far up the errant bolt travels before fizzling — kept short so it clearly
// stops well below where an asteroid would be (the visual opposite of a hit).
const BOLT_HEIGHT = 120;
// Sideways veer of the endpoint, mirrored in the CSS keyframe's final transform.
const VEER_X = 22;

// Transient one-shot effect: a red bolt fired from the cannon tip that shoots
// up a short distance, veers off to one side, and fizzles out short of the
// target. The parent mounts one per miss (keyed by miss id) and unmounts it
// after the CSS animation finishes — no state in here (mirrors LaserBeam).
export function MissBolt() {
  const endpointY = CANNON_TIP_Y - BOLT_HEIGHT;

  return (
    <>
      <div
        className="vd-miss-bolt"
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: `${endpointY}px`,
          height: `${BOLT_HEIGHT}px`,
          width: "4px",
          transformOrigin: "center bottom",
          borderRadius: "2px",
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--color-danger) 55%, transparent), var(--color-danger))",
          boxShadow: "0 0 10px color-mix(in srgb, var(--color-danger) 60%, transparent)",
          pointerEvents: "none",
        }}
      />
      <div
        className="vd-miss-fizzle"
        aria-hidden
        style={{
          position: "absolute",
          left: `calc(50% + ${VEER_X}px)`,
          top: `${endpointY}px`,
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-danger) 50%, transparent) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}
