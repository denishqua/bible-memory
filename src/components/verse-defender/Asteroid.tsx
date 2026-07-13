import type { Token } from "../../lib/tokenize";
import type { DescentPhase } from "../../lib/verseDefenderEngine";
import { getRevealedCount, maskedGlyphs } from "../../lib/verseDefenderEngine";
import { FIELD_HEIGHT, ASTEROID_HEIGHT, CANNON_ZONE_HEIGHT } from "./AsteroidField";

interface AsteroidProps {
  word: Token;
  progress: number; // 0..1 descent progress
  phase: DescentPhase;
  breached: boolean; // true while the game is breach-paused (asteroid sits at the base)
}

const PHASE_COLOR: Record<DescentPhase, string> = {
  "deep-space": "var(--color-sage)",
  "orbital-entry": "var(--color-clay)",
  crisis: "var(--color-danger)",
};

export function Asteroid({ word, progress, phase, breached }: AsteroidProps) {
  const accent = breached ? "var(--color-danger)" : PHASE_COLOR[phase];
  const glowStrength = breached ? "45%" : phase === "crisis" ? "35%" : "20%";
  const glowSize = breached ? "26px" : phase === "crisis" ? "20px" : "12px";
  const revealed = getRevealedCount(progress, word.normalized.length);

  // Rocky texture: an irregular blob outline plus a few crater dimples layered
  // as radial-gradients — reads as an asteroid instead of a UI pill, while the
  // word stays horizontal and legible in the middle.
  const rockRadius = "46% 54% 52% 48% / 58% 44% 56% 42%";
  const rockBase = "color-mix(in srgb, var(--color-ink) 12%, var(--color-surface))";
  const crater = "color-mix(in srgb, var(--color-ink) 22%, var(--color-surface))";

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%) rotate(-3deg)",
        // No transition on `top` — movement comes from rAF-driven re-renders.
        top: `${progress * (FIELD_HEIGHT - ASTEROID_HEIGHT - CANNON_ZONE_HEIGHT)}px`,
        height: `${ASTEROID_HEIGHT}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 2rem",
        borderRadius: rockRadius,
        border: `2px solid ${accent}`,
        background: [
          // Crater dimples (top-left, right, bottom-center)…
          `radial-gradient(circle 9px at 22% 30%, ${crater} 0 7px, transparent 8px)`,
          `radial-gradient(circle 7px at 78% 42%, ${crater} 0 5px, transparent 6px)`,
          `radial-gradient(circle 6px at 45% 78%, ${crater} 0 4px, transparent 5px)`,
          // …over a lit-from-upper-left rocky body.
          `radial-gradient(ellipse at 35% 30%, var(--color-surface) 0%, ${rockBase} 65%, color-mix(in srgb, var(--color-ink) 20%, var(--color-surface)) 100%)`,
        ].join(", "),
        boxShadow: `0 0 ${glowSize} color-mix(in srgb, ${accent} ${glowStrength}, transparent), inset -6px -6px 14px color-mix(in srgb, var(--color-ink) 18%, transparent)`,
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.3rem",
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--color-ink)",
          whiteSpace: "nowrap",
          transform: "rotate(3deg)", // counter the body tilt so text stays level
        }}
      >
        {maskedGlyphs(word.normalized, revealed)}
      </span>
    </div>
  );
}
