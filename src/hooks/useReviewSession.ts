import { useCallback, useState } from "react";
import type { Token } from "../lib/tokenize";
import { initialVisibility, type Visibility } from "../lib/reviewModes";
import { calculateAccuracy } from "../lib/accuracy";
import type { MaskableReviewMode } from "../types/review";

export interface WordRuntimeState {
  index: number;
  token: Token;
  visible: Visibility; // from initialVisibility(), constant for the session
  completed: boolean; // flips true on correct first-letter keystroke
  attempts: number; // wrong keystrokes on this word
  typedCount: number; // letters correctly typed so far (whole-word mode); 0 in first-letter mode
  revealedCount: number; // letters revealed as hints so far (whole-word mode, on miss); 0 otherwise
}
// Display rule (applied by the UI layer, not stored here): if `visible ===
// "full"`, always render the full word. If `"masked" && !completed`, render
// `attempts` leading letters starting from index 1 (never index 0 — the real
// first letter is only ever revealed by `completed` flipping true), capped at
// `word.length - 1`. If `"masked" && completed`, render the full word. Capping
// is a presentation concern, so `attempts` here is stored uncapped (a plain
// count of wrong keystrokes on the current word).

export type ReviewStatus = "in-progress" | "complete";

export interface UseReviewSessionResult {
  words: WordRuntimeState[];
  currentIndex: number;
  // LIVE running accuracy over only the words ENGAGED so far (completed OR
  // attempts > 0): clean-engaged words (attempts === 0) / engaged words * 100.
  // 100 when nothing is engaged yet (calculateAccuracy's empty-set behavior).
  // Among engaged words, attempts === 0 implies completed, so this is exactly
  // "clean completions / words touched". At completion every matchable word is
  // engaged, so it collapses to the old overall value (clean / total).
  accuracy: number;
  status: ReviewStatus;
  handleKeyPress: (char: string) => void;
  reset: () => void; // full reset for retry — no carried-over reveals
}

interface InternalState {
  words: WordRuntimeState[];
  currentIndex: number;
}

// Named keys that can reach a plain onChange/onBeforeInput-driven handler but
// are never a single character to type (Shift/Ctrl/Alt/Enter/Backspace/arrows/
// Tab/Meta, etc. — spec-review fix #1). Anything that survives this AND is
// exactly one character long is accepted, whatever character it is — including
// digits and symbols, so a word like "12" is typeable by pressing "1".
const NON_CHARACTER_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "Enter",
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "CapsLock",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
]);

function isPrintableCharacter(char: string): boolean {
  if (NON_CHARACTER_KEYS.has(char)) return false;
  // The length check is what actually does the work above (every named key is
  // more than one character); the explicit set just documents intent per spec.
  return char.length === 1;
}

function buildInitialWords(tokens: Token[], mode: MaskableReviewMode): WordRuntimeState[] {
  return tokens.map((token, index) => ({
    index,
    token,
    visible: initialVisibility(mode, index),
    completed: false,
    attempts: 0,
    typedCount: 0,
    revealedCount: 0,
  }));
}

// Spec-review fix #2: currentIndex must skip past any non-matchable token
// (line breaks, verse-number markers, stray punctuation-only tokens) without
// ever waiting for a keystroke. Used both on init and after every completion.
function firstPendingMatchableIndex(words: WordRuntimeState[], from: number): number {
  let i = from;
  while (i < words.length && !words[i].token.matchable) {
    i++;
  }
  return i;
}

function initialize(tokens: Token[], mode: MaskableReviewMode): InternalState {
  const words = buildInitialWords(tokens, mode);
  return {
    words,
    currentIndex: firstPendingMatchableIndex(words, 0),
  };
}

// A matchable word is "engaged" once the player has interacted with it —
// either completed it or gotten it wrong at least once. Words not yet reached
// are NOT engaged and stay out of the live-accuracy denominator.
function isEngaged(word: WordRuntimeState): boolean {
  return word.token.matchable && (word.completed || word.attempts > 0);
}

// Live running accuracy over a set of runtime words: clean-engaged words
// (attempts === 0) over engaged words. Empty set → 100 (nothing typed yet).
// Shared by the hook's headline number and by perVerseAccuracy per segment.
function liveAccuracy(words: WordRuntimeState[]): number {
  const engaged = words.filter(isEngaged);
  const clean = engaged.filter((w) => w.attempts === 0).length;
  return calculateAccuracy(clean, engaged.length);
}

// A reference marker is the non-matchable, display-only "— John 3:16 —" token
// spliced between verses in a bulk (collection) review — distinguished from a
// line break or a verse-number marker, which are also non-matchable but not
// verse boundaries. (See buildCollectionReviewTokens.)
function isReferenceMarker(word: WordRuntimeState): boolean {
  const { token } = word;
  return !token.matchable && !token.isLineBreak && !token.isVerseNumber;
}

// Segments a runtime word stream into per-verse groups at reference-marker
// boundaries and returns each group's LIVE accuracy (same engaged-based formula
// as the headline number), one entry per verse in order. The first group is
// everything before the first reference marker (there is never a marker before
// the first verse). `startIndex` is the token index the group begins at (0 for
// the first group, the marker's index for each later group), so callers can map
// a currentIndex back to the verse it falls in. Pure — used for the per-verse
// breakdown in bulk review.
export function perVerseAccuracy(
  words: WordRuntimeState[],
): { startIndex: number; accuracy: number }[] {
  const segments: { startIndex: number; accuracy: number }[] = [];
  let start = 0;
  let group: WordRuntimeState[] = [];
  for (let i = 0; i < words.length; i++) {
    if (isReferenceMarker(words[i])) {
      segments.push({ startIndex: start, accuracy: liveAccuracy(group) });
      start = i;
      group = [];
      continue;
    }
    group.push(words[i]);
  }
  segments.push({ startIndex: start, accuracy: liveAccuracy(group) });
  return segments;
}

// The shared engine behind all 3 modes (Type It / Memorize It / Master It):
// every word requires the player to type it correctly to advance — in
// first-letter mode a single correct first letter, in whole-word mode every
// letter in order. Modes differ only in whether a word's text is visible
// beforehand. Deliberately has no knowledge of <input>/focus/DOM — the UI layer
// owns the hidden focused input and calls handleKeyPress from its change events
// (spec-review fix #5). `requireWholeWord` (an app-level setting, static for the
// life of a session) selects between the two input styles.
export function useReviewSession(
  tokens: Token[],
  mode: MaskableReviewMode,
  requireWholeWord = false,
): UseReviewSessionResult {
  const [state, setState] = useState<InternalState>(() => initialize(tokens, mode));

  // requireWholeWord is in the deps so toggling the setting produces a fresh
  // reset() identity — a mode change should restart the session cleanly rather
  // than leave a half-typed word straddling two input styles.
  const reset = useCallback(() => {
    setState(initialize(tokens, mode));
  }, [tokens, mode, requireWholeWord]);

  const handleKeyPress = useCallback(
    (char: string) => {
      if (!isPrintableCharacter(char)) return;

      setState((prev) => {
        if (prev.currentIndex >= prev.words.length) return prev; // already complete

        const currentWord = prev.words[prev.currentIndex];
        const words = prev.words.slice();

        if (requireWholeWord) {
          // Whole-word mode: match the next expected char at the current typed
          // offset. A correct char advances typedCount; the word only completes
          // (and we advance to the next word) once every letter is typed. A
          // wrong char marks the word (attempts++) but never rewinds progress.
          const expected = currentWord.token.normalized[currentWord.typedCount];
          const isMatch = expected !== undefined && char.toLowerCase() === expected.toLowerCase();

          if (isMatch) {
            const typedCount = currentWord.typedCount + 1;
            if (typedCount === currentWord.token.normalized.length) {
              words[prev.currentIndex] = { ...currentWord, typedCount, completed: true };
              const nextIndex = firstPendingMatchableIndex(words, prev.currentIndex + 1);
              return { words, currentIndex: nextIndex };
            }
            words[prev.currentIndex] = { ...currentWord, typedCount };
            return { ...prev, words };
          }

          // A miss also advances the reveal frontier by one letter — a
          // progressive hint mirroring first-letter mode's reveal-on-miss, but
          // for whole-word input. It reveals from wherever the player is stuck,
          // one letter past the current max(revealed, typed) frontier, capped at
          // the word length. `attempts` still owns scoring/flash; `revealedCount`
          // is purely presentational.
          const revealedCount = Math.min(
            currentWord.token.normalized.length,
            Math.max(currentWord.revealedCount, currentWord.typedCount) + 1,
          );
          words[prev.currentIndex] = {
            ...currentWord,
            attempts: currentWord.attempts + 1,
            revealedCount,
          };
          return { ...prev, words };
        }

        // First-letter mode (default): one correct first letter completes and
        // advances the word.
        const expected = currentWord.token.normalized[0];
        const isMatch = expected !== undefined && char.toLowerCase() === expected.toLowerCase();

        if (isMatch) {
          words[prev.currentIndex] = { ...currentWord, completed: true };
          const nextIndex = firstPendingMatchableIndex(words, prev.currentIndex + 1);
          return { words, currentIndex: nextIndex };
        }

        // Mismatch: attempts++ drives both the progressive reveal cap and the
        // word-based score — a word with attempts > 0 is a "wrong" word, counted
        // once no matter how many times it's missed.
        words[prev.currentIndex] = { ...currentWord, attempts: currentWord.attempts + 1 };
        return { ...prev, words };
      });
    },
    [requireWholeWord],
  );

  const status: ReviewStatus = state.currentIndex >= state.words.length ? "complete" : "in-progress";
  // Live word-based accuracy over only the ENGAGED words (see liveAccuracy /
  // UseReviewSessionResult.accuracy). Missing the same word repeatedly
  // (attempts > 1) is still counted once. At completion every matchable word is
  // engaged, so this equals the old overall clean/total value — the stored
  // session record below relies on that identity.
  const accuracy = liveAccuracy(state.words);

  return {
    words: state.words,
    currentIndex: state.currentIndex,
    accuracy,
    status,
    handleKeyPress,
    reset,
  };
}
