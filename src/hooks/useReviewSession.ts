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
  accuracy: number; // clean words / total words * 100 (a word missed repeatedly counts once)
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

// The shared engine behind all 3 modes (Type It / Memorize It / Master It):
// every word requires exactly one correct first-letter keystroke to advance,
// modes differ only in whether a word's text is visible beforehand. Deliberately
// has no knowledge of <input>/focus/DOM — the UI layer owns the hidden focused
// input and calls handleKeyPress from its change events (spec-review fix #5).
export function useReviewSession(
  tokens: Token[],
  mode: MaskableReviewMode,
): UseReviewSessionResult {
  const [state, setState] = useState<InternalState>(() => initialize(tokens, mode));

  const reset = useCallback(() => {
    setState(initialize(tokens, mode));
  }, [tokens, mode]);

  const handleKeyPress = useCallback((char: string) => {
    if (!isPrintableCharacter(char)) return;

    setState((prev) => {
      if (prev.currentIndex >= prev.words.length) return prev; // already complete

      const currentWord = prev.words[prev.currentIndex];
      const expected = currentWord.token.normalized[0];
      const isMatch = expected !== undefined && char.toLowerCase() === expected.toLowerCase();

      const words = prev.words.slice();

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
  }, []);

  const status: ReviewStatus = state.currentIndex >= state.words.length ? "complete" : "in-progress";
  // Word-based accuracy: matchable words completed with no wrong keystroke over
  // the total. Missing the same word repeatedly (attempts > 1) is only counted
  // once, so it's never double-punished. Words not yet reached count as clean,
  // so a session starts at 100% and only drops as words are gotten wrong.
  const matchableWords = state.words.filter((w) => w.token.matchable);
  const cleanWords = matchableWords.filter((w) => w.attempts === 0).length;
  const accuracy = calculateAccuracy(cleanWords, matchableWords.length);

  return {
    words: state.words,
    currentIndex: state.currentIndex,
    accuracy,
    status,
    handleKeyPress,
    reset,
  };
}
