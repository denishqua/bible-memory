import type { WordRuntimeState } from "../../hooks/useReviewSession";

interface WordTokenProps {
  word: WordRuntimeState;
  isCurrent: boolean;
}

const BLANK_CHAR = "_";

// Display rule (from the plan): if visible === "masked" && !completed, render
// `attempts` leading letters starting from index 1 (never index 0 — the real
// first letter is only ever revealed by `completed` flipping true), capped at
// word.length - 1.
function maskedGlyphs(word: WordRuntimeState): string {
  const letters = word.token.normalized;
  if (letters.length === 0) return "";
  const revealedCount = Math.min(word.attempts, letters.length - 1);
  return letters
    .split("")
    .map((letter, i) => (i > 0 && i <= revealedCount ? letter : BLANK_CHAR))
    .join("");
}

// Pure presentational component — no state, no knowledge of the engine beyond
// the WordRuntimeState it's handed. The parent is responsible for keying this
// component by `${word.index}-${word.attempts}` so a wrong keystroke (which
// bumps `attempts`) forces a remount and replays the flash/shake animation
// from scratch, even on repeated misses of the same word.
export function WordToken({ word, isCurrent }: WordTokenProps) {
  const { token } = word;

  if (token.isLineBreak) {
    return <br />;
  }

  if (!token.matchable) {
    // Verse-number markers (and stray punctuation-only tokens) are shown as
    // context only — never masked, never typed (spec-review fix #4).
    return (
      <span
        style={{
          display: "inline-block",
          marginRight: "0.3em",
          fontSize: token.isVerseNumber ? "0.7em" : "1.15rem",
          verticalAlign: token.isVerseNumber ? "super" : "baseline",
          color: "var(--color-ink-muted)",
        }}
      >
        {token.isVerseNumber ? token.raw.replace(/[[\]]/g, "") : token.raw}
      </span>
    );
  }

  const showFull = word.visible === "full" || word.completed;
  const display = showFull ? token.raw : maskedGlyphs(word);
  const isFlashing = isCurrent && !word.completed && word.attempts > 0;

  return (
    <span
      className={isFlashing ? "word-token word-token--flash" : "word-token"}
      style={{
        display: "inline-block",
        marginRight: "0.35em",
        fontFamily: "var(--font-serif)",
        fontSize: "1.15rem",
        letterSpacing: showFull ? "normal" : "0.08em",
        borderBottom: isCurrent ? "2px solid var(--color-clay)" : "2px solid transparent",
        paddingBottom: "0.1em",
      }}
    >
      {display}
    </span>
  );
}
