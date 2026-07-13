import type { Token } from "../../lib/tokenize";
import { maskedGlyphs } from "../../lib/verseDefenderEngine";

interface BreachOverlayProps {
  word: Token;
  livesRemaining: number; // already clamped >= 0
  outOfLives: boolean; // collection scope hit 0 lives — softer "keep going" copy
  /** Hint active: show the full raw word in the ghost style instead of the
      almost-full mask. */
  hinted?: boolean;
}

export function BreachOverlay({ word, outOfLives, hinted }: BreachOverlayProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
        // CRITICAL: the hidden input underneath must keep receiving keystrokes.
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.6rem",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.9rem",
          boxShadow: "var(--shadow-soft)",
          padding: "1.25rem 1.75rem",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.4rem",
            color: "var(--color-danger)",
            margin: 0,
          }}
        >
          Breach!
        </h3>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.6rem",
            fontWeight: 600,
            letterSpacing: hinted ? "normal" : "0.15em",
            color: hinted ? "var(--color-ink-muted)" : "var(--color-ink)",
            opacity: hinted ? 0.75 : 1,
            fontStyle: hinted ? "italic" : "normal",
          }}
        >
          {hinted ? word.raw : maskedGlyphs(word.normalized, word.normalized.length - 1)}
        </span>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--color-ink-muted)",
            margin: 0,
          }}
        >
          {outOfLives
            ? "Shields down — type the first letter to press on."
            : "Type the first letter to repel it."}
        </p>
      </div>
    </div>
  );
}
