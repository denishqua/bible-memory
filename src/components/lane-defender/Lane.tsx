import { FallingWord } from "./FallingWord";
import type { LaneWordView } from "../../hooks/useLaneDefenderSession";

interface LaneProps {
  laneKey: string; // "D" | "F" | "J" | "K"
  word: LaneWordView | null;
}

// One vertical column of the play field: a relative-positioned descent area
// holding at most one FallingWord, a "firing line" rule at the bottom, and a
// key-label footer showing which key fires this lane.
export function Lane({ laneKey, word }: LaneProps) {
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
