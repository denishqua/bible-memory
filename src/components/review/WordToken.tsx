import { memo, type ReactNode } from "react";
import type { WordRuntimeState } from "../../hooks/useReviewSession";

interface WordTokenProps {
  word: WordRuntimeState;
  isCurrent: boolean;
  /** Hint active for this (current) word: reveal the full text in a muted,
      italic "ghost" style. The player still has to type the first letter. */
  isHinted?: boolean;
  /** Whole-word input mode: reveals track `typedCount` (letters typed) and
      `revealedCount` (letters hinted on miss) per letter, rather than the
      first-letter mode's `attempts`-driven reveal. Mirrors the setting in
      useReviewSession. */
  wholeWord?: boolean;
}

const BLANK_CHAR = "_";

// Shared faint style for not-yet-typed letters — the dimmed tail of a "given"
// word (whole-word reveal) and the revealed-but-untyped hint letters of a
// masked word. Colors in to full ink the moment the player types the letter.
const FAINT_STYLE = { color: "var(--color-ink-muted)" } as const;

// First-letter mode reveal (from the plan): if visible === "masked" &&
// !completed, render `attempts` leading letters starting from index 1 (never
// index 0 — the real first letter is only ever revealed by `completed` flipping
// true), capped at word.length - 1.
function maskedGlyphs(word: WordRuntimeState): string {
  const letters = word.token.normalized;
  if (letters.length === 0) return "";
  const revealedCount = Math.min(word.attempts, letters.length - 1);
  return letters
    .split("")
    .map((letter, i) => (i > 0 && i <= revealedCount ? letter : BLANK_CHAR))
    .join("");
}

// Whole-word mode, "given" (always-visible) words: the full raw text is shown,
// but the letters not yet typed are dimmed and color in one at a time as the
// player types them. `typedCount` indexes word.normalized (letters only,
// lowercased), while the displayed text is word.raw (with capitals and
// punctuation) — so map the typed-letter count onto a raw-string cut point.
// `normalized` is always a subsequence of raw.toLowerCase() (normalizeWord only
// lowercases and DROPS characters), so a greedy left-to-right walk lines each
// normalized letter up with its raw position. Returns the length of the raw
// prefix to render at full color; the remainder is dimmed. Trailing punctuation
// stays dimmed until the word completes (a completed word takes the full-color
// path, not this one).
function revealedRawLength(raw: string, normalized: string, typedCount: number): number {
  if (typedCount <= 0) return 0;
  let matched = 0;
  for (let i = 0; i < raw.length; i++) {
    const expected = normalized[matched];
    if (expected !== undefined && raw[i].toLowerCase() === expected) {
      matched++;
      if (matched === typedCount) return i + 1;
    }
  }
  return raw.length;
}

// Pure presentational component — no state, no knowledge of the engine beyond
// the WordRuntimeState it's handed. The parent is responsible for keying this
// component by `${word.index}-${word.attempts}` so a wrong keystroke (which
// bumps `attempts`) forces a remount and replays the flash/shake animation
// from scratch, even on repeated misses of the same word.
//
// Memoized: useReviewSession keeps unchanged WordRuntimeState object
// references stable across keystrokes, so in bulk sessions (thousands of
// tokens) only the words whose `word` or `isCurrent` props actually changed
// re-render. Memoization never blocks the miss animation — a key change
// forces a remount regardless of memo.
export const WordToken = memo(function WordToken({ word, isCurrent, isHinted, wholeWord }: WordTokenProps) {
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
  // A hint only applies to a still-masked, not-yet-completed word (visible ===
  // "masked" && !completed) — exactly the !showFull case. It reveals the raw
  // text in a distinct ghost style; it never completes the word.
  const showHint = !showFull && isHinted === true;
  // Whole-word mode: a "given" word (always visible — every word in Type It,
  // the shown words in Memorize It) that isn't finished yet displays its full
  // text with the not-yet-typed letters dimmed, coloring each in as it's typed.
  // This gives visible words the same progressive feedback masked words get from
  // the reveal below. First-letter mode can't show per-letter progress, so it
  // keeps the plain full-color text.
  const showGivenReveal = wholeWord && word.visible === "full" && !word.completed;
  // Whole-word mode: a still-masked, not-yet-completed word (not currently
  // hinted) shows the letters typed so far in full ink, the letters revealed by
  // misses in faint ink, and everything past the frontier as "_" blanks. This
  // is whole-word's analogue of first-letter mode's `maskedGlyphs` reveal.
  const showMaskedReveal =
    wholeWord && word.visible === "masked" && !word.completed && !showHint;
  const isFlashing = isCurrent && !word.completed && word.attempts > 0;

  let content: ReactNode;
  if (showGivenReveal) {
    const cut = revealedRawLength(token.raw, token.normalized, word.typedCount);
    content = (
      <>
        {token.raw.slice(0, cut)}
        <span style={FAINT_STYLE}>{token.raw.slice(cut)}</span>
      </>
    );
  } else if (showMaskedReveal) {
    // Three zones over the normalized letters: typed (full ink), revealed-but-
    // not-yet-typed (faint), then blanks. The reveal frontier never sits behind
    // what's already typed, so max(typedCount, revealedCount) bounds the faint
    // zone's end and the blanks' start.
    const letters = token.normalized;
    const typed = word.typedCount;
    const revealed = Math.max(word.typedCount, word.revealedCount);
    content = (
      <>
        {letters.slice(0, typed)}
        <span style={FAINT_STYLE}>{letters.slice(typed, revealed)}</span>
        {BLANK_CHAR.repeat(letters.length - revealed)}
      </>
    );
  } else {
    // Fully-shown words (given/completed/hinted) render the raw text; first-
    // letter mode's masked words keep their `attempts`-driven reveal.
    content = showFull || showHint ? token.raw : maskedGlyphs(word);
  }

  return (
    <span
      className={isFlashing ? "word-token word-token--flash" : "word-token"}
      data-current={isCurrent ? "true" : undefined}
      style={{
        display: "inline-block",
        marginRight: "0.35em",
        fontFamily: "var(--font-serif)",
        fontSize: "1.15rem",
        letterSpacing: showFull || showHint ? "normal" : "0.08em",
        borderBottom: isCurrent ? "2px solid var(--color-clay)" : "2px solid transparent",
        paddingBottom: "0.1em",
        ...(showHint
          ? { color: "var(--color-ink-muted)", opacity: 0.75, fontStyle: "italic" }
          : undefined),
      }}
    >
      {content}
    </span>
  );
});
