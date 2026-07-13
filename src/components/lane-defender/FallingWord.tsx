import type { LaneWordView } from "../../hooks/useLaneDefenderSession";

interface FallingWordProps {
  word: LaneWordView;
}

export function FallingWord({ word }: FallingWordProps) {
  const pct = word.progress * 100;
  // Smooth color shift toward the warm clay tone as the word nears the firing
  // line — a continuous urgency cue, no discrete phases.
  const warmth = Math.round(word.progress * 100);

  return (
    <span
      style={{
        position: "absolute",
        left: "50%",
        top: `${pct}%`,
        // translate(-50%, -progress*100%) keeps the word fully inside the
        // lane: top edge flush at progress 0, bottom edge kissing the firing
        // line at progress 1.
        transform: `translate(-50%, -${pct}%)`,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-serif)",
        fontSize: "1.05rem",
        letterSpacing: "0.08em",
        color: `color-mix(in srgb, var(--color-clay) ${warmth}%, var(--color-ink))`,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {word.raw}
    </span>
  );
}
