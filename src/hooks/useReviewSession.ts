import { useCallback, useState } from "react";
import { isBetweenVerseReferenceMarker, type Token } from "../lib/tokenize";
import { initialVisibility, type Visibility } from "../lib/reviewModes";
import { calculateAccuracy } from "../lib/accuracy";
import { isPrintableCharacter } from "../lib/keyboard";
import type { MaskableReviewMode } from "../types/review";
import { reduceFirstLetterInput, reduceWholeWordInput, firstPendingMatchableIndex } from "../lib/reviewReducers";


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

type ReviewStatus = "in-progress" | "complete";

interface UseReviewSessionResult {
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

function buildInitialWords(tokens: Token[], mode: MaskableReviewMode): WordRuntimeState[] {
  return tokens.map((token, index) => ({
    index,
    token,
    // The appended reference words are ALWAYS masked, whatever the mode — so
    // recalling the reference is a genuine challenge even in Type It (where the
    // verse words are fully visible). Everything else follows the mode.
    visible: token.isReference && token.matchable ? "masked" : initialVisibility(mode, index),
    completed: false,
    attempts: 0,
    typedCount: 0,
    revealedCount: 0,
  }));
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
    // A between-verse "— John 3:16 —" marker (non-matchable, not a line break or
    // verse number) opens a new segment. The predicate's `!isReference` clause
    // excludes the single-verse reference delimiter, which shares this shape but
    // is not a verse boundary (bulk review never appends one).
    if (isBetweenVerseReferenceMarker(words[i].token)) {
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
// letter in order followed by a space (typed like a real sentence — see the
// requireWholeWord branch in handleKeyPress). Modes differ only in whether a
// word's text is visible beforehand. Deliberately has no knowledge of
// <input>/focus/DOM — the UI layer
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
  }, [tokens, mode]);

  const handleKeyPress = useCallback(
    (char: string) => {
      if (!isPrintableCharacter(char)) return;

      setState((prev) => {
        if (prev.currentIndex >= prev.words.length) return prev;
        return requireWholeWord
          ? reduceWholeWordInput(prev, char)
          : reduceFirstLetterInput(prev, char);
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
