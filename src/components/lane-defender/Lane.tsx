import { FallingWord } from "./FallingWord";
import type { LaneWordView, ShotEvent } from "../../hooks/useLaneDefenderSession";

interface LaneProps {
  laneKey: string; // "D" | "F" | "J" | "K"
  word: LaneWordView | null;
  // The most recent shot IF it fired this lane, else null. Drives the laser
  // and wrong-press flash; keyed by shot.id so it replays on every press.
  shot: ShotEvent | null;
}

// One vertical column of the play field: a relative-positioned descent area
// holding at most one FallingWord, a "firing line" rule at the bottom, and a
// key-label footer showing which key fires this lane.
export function Lane({ laneKey, word, shot }: LaneProps) {
  // A wrong-lane press blasts red; a clean hit (or an empty-lane press) blasts
  // in the warm clay tone.
  const wrong = shot?.outcome === "miss";
  const beamColor = wrong ? "var(--color-danger)" : "var(--color-clay)";

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.7rem",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", flex: 1 }}>
        {word !== null && <FallingWord key={word.queueIndex} word={word} />}

        {shot !== null && (
          <>
            {/* Laser: a vertical beam fired up the lane from the gun. Wide
                enough to read at a glance, with a strong glow around it. */}
            <div
              key={`beam-${shot.id}`}
              className="ld-laser"
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: "7px",
                borderRadius: "3.5px",
                background: `linear-gradient(to top, ${beamColor}, color-mix(in srgb, ${beamColor} 15%, transparent))`,
                boxShadow: `0 0 18px color-mix(in srgb, ${beamColor} 85%, transparent)`,
                pointerEvents: "none",
              }}
            />
            {/* Muzzle flash at the gun — sat just inside the bottom of the
                descent area (the firing line) so overflow:hidden can't clip it. */}
            <div
              key={`muzzle-${shot.id}`}
              className="ld-muzzle"
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                bottom: 0,
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${beamColor} 0%, transparent 68%)`,
                pointerEvents: "none",
              }}
            />
            {/* Wrong-lane press: red wash over the whole lane as the mistake
                cue (paired with the red beam above so it isn't color-only). */}
            {wrong && (
              <div
                key={`flash-${shot.id}`}
                className="ld-lane-flash"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "var(--color-danger)",
                  pointerEvents: "none",
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Firing line */}
      <div style={{ borderTop: "2px solid var(--color-clay)" }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.45rem 0",
          background: "var(--color-surface)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.7rem",
            height: "1.7rem",
            borderRadius: "0.45rem",
            border: "1px solid var(--color-border)",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--color-ink)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          {laneKey}
        </span>
      </div>
    </div>
  );
}
