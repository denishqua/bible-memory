// Pure game logic for Verse Defender (tower-defense asteroids) — no React, no
// DOM, no timers. The hook (useVerseDefenderSession.ts) owns the
// requestAnimationFrame loop and feeds elapsed time / keystrokes into the
// pure transition functions here, mirroring how useReviewSession.ts keeps
// reviewModes.ts/tokenize.ts DOM-free.

import type { Token } from "./tokenize";
import type { ReviewResult } from "../types/review";

/** How long an asteroid takes to fall from deep space to the base. */
export const DESCENT_DURATION_MS = 6000;

/** Lives per verse (collection scope resets to this at every verse boundary). */
export const MAX_LIVES = 3;

/**
 * Session-level status. Exactly one asteroid is in flight while
 * "spawning-playing"; "breach-paused" freezes the descent at the base until
 * the player retypes the same word; "complete"/"failed" are terminal.
 */
export type VerseDefenderStatus =
  | "spawning-playing"
  | "breach-paused"
  | "complete"
  | "failed";

/** Visual urgency only — a pure function of descent progress, never of input. */
export type DescentPhase = "deep-space" | "orbital-entry" | "crisis";

export type LivesResult = Extract<ReviewResult, { type: "lives" }>;

export interface VerseDefenderState {
  /** Every matchable token, in order — spawn order AND required destroy order. */
  queue: Token[];
  /**
   * Queue indices at which a new verse starts (collection scope only; never
   * includes 0 — the first verse's lives are set by createInitialState).
   */
  verseBoundaries: ReadonlySet<number>;
  isCollection: boolean;
  currentWordIndex: number;
  livesRemaining: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  /**
   * Collection scope: set (and never cleared) the first time lives hit 0 on
   * any verse — finishing the marathon after that still records passed: false.
   */
  everRanOutOfLives: boolean;
  status: VerseDefenderStatus;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getDescentProgress(elapsedMs: number): number {
  return clamp01(elapsedMs / DESCENT_DURATION_MS);
}

export function getDescentPhase(progress: number): DescentPhase {
  if (progress < 0.4) return "deep-space";
  if (progress < 0.8) return "orbital-entry";
  return "crisis";
}

/**
 * Fog-by-descent-time: how many trailing letters are readable at this point
 * in the descent. Index 0 is never included — the first letter stays hidden
 * for the whole fall (it's the letter the player has to produce).
 */
export function getRevealedCount(progress: number, wordLength: number): number {
  return Math.floor(clamp01(progress) * Math.max(0, wordLength - 1));
}

const BLANK_CHAR = "_";

/**
 * Same glyph convention as the mask engine's WordToken: render
 * `normalized.length` characters, index 0 always hidden, indices
 * 1..revealedCount shown as real letters, the rest hidden.
 */
export function maskedGlyphs(normalized: string, revealedCount: number): string {
  return normalized
    .split("")
    .map((letter, i) => (i > 0 && i <= revealedCount ? letter : BLANK_CHAR))
    .join("");
}

// Named keys that can reach a plain onChange-driven handler but are never a
// single character to type. The length check below does the real work (every
// named key is more than one character); the set documents intent — same
// filtering idea as the mask engine's input path.
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

export function isPrintableCharacter(char: string): boolean {
  if (NON_CHARACTER_KEYS.has(char)) return false;
  return char.length === 1;
}

/**
 * Reference-marker tokens are the only tokens in a collection stream that are
 * non-matchable but neither line breaks nor verse numbers (see
 * collectionReview.ts — "— Romans 8:28 —" spliced between verses).
 */
function isReferenceMarker(token: Token): boolean {
  return !token.matchable && !token.isLineBreak && !token.isVerseNumber;
}

export function createInitialState(tokens: Token[], isCollection: boolean): VerseDefenderState {
  const queue: Token[] = [];
  const verseBoundaries = new Set<number>();

  for (const token of tokens) {
    if (token.matchable) {
      queue.push(token);
    } else if (isCollection && isReferenceMarker(token)) {
      // The next matchable token starts a new verse; its queue index is
      // however many matchable tokens preceded this marker.
      verseBoundaries.add(queue.length);
    }
  }

  return {
    queue,
    verseBoundaries,
    isCollection,
    currentWordIndex: 0,
    livesRemaining: MAX_LIVES,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    everRanOutOfLives: false,
    status: queue.length === 0 ? "complete" : "spawning-playing",
  };
}

/**
 * Correct keystroke while playing (asteroid destroyed) OR while breach-paused
 * (successful retype). Advances the queue, resets lives at a verse boundary,
 * and completes the session when the queue is exhausted.
 */
function advanceAfterCorrect(state: VerseDefenderState): VerseDefenderState {
  const nextIndex = state.currentWordIndex + 1;
  const counted = {
    totalKeystrokes: state.totalKeystrokes + 1,
    correctKeystrokes: state.correctKeystrokes + 1,
  };

  if (nextIndex >= state.queue.length) {
    return { ...state, ...counted, currentWordIndex: nextIndex, status: "complete" };
  }

  const livesRemaining = state.verseBoundaries.has(nextIndex) ? MAX_LIVES : state.livesRemaining;

  return {
    ...state,
    ...counted,
    currentWordIndex: nextIndex,
    livesRemaining,
    status: "spawning-playing",
  };
}

/**
 * Feed one already-filtered printable character into the state machine.
 * Wrong keystrokes only count toward totalKeystrokes — they never reveal
 * letters or cost lives in this mode.
 */
export function handleKeystroke(state: VerseDefenderState, char: string): VerseDefenderState {
  if (state.status !== "spawning-playing" && state.status !== "breach-paused") {
    return state;
  }

  const word = state.queue[state.currentWordIndex];
  const expected = word?.normalized[0];
  const isMatch = expected !== undefined && char.toLowerCase() === expected.toLowerCase();

  if (isMatch) {
    return advanceAfterCorrect(state);
  }

  return { ...state, totalKeystrokes: state.totalKeystrokes + 1 };
}

/**
 * The current asteroid reached the base (progress >= 1) undestroyed.
 * Single-verse scope: hitting 0 lives fails the mission outright.
 * Collection scope: lives clamp at 0 (flagging everRanOutOfLives) and the
 * breach-paused retype rule still applies, so the player is never stuck.
 */
export function registerBreach(state: VerseDefenderState): VerseDefenderState {
  if (state.status !== "spawning-playing") return state;

  const lives = state.livesRemaining - 1;

  if (!state.isCollection && lives <= 0) {
    return { ...state, livesRemaining: 0, status: "failed" };
  }

  const clamped = Math.max(0, lives);
  return {
    ...state,
    livesRemaining: clamped,
    everRanOutOfLives: state.everRanOutOfLives || clamped === 0,
    status: "breach-paused",
  };
}

/**
 * The "lives" ReviewResult branch for a terminal state.
 * - failed (single-verse only): passed false, 0 lives.
 * - complete, single-verse: passed iff lives remained above 0.
 * - complete, collection: passed iff lives never hit 0 on any verse.
 */
export function buildSessionResult(state: VerseDefenderState): LivesResult {
  const livesRemaining = Math.max(0, state.livesRemaining);
  const passed =
    state.status === "failed"
      ? false
      : state.isCollection
        ? !state.everRanOutOfLives
        : livesRemaining > 0;

  return {
    type: "lives",
    livesRemaining,
    totalKeystrokes: state.totalKeystrokes,
    correctKeystrokes: state.correctKeystrokes,
    passed,
  };
}
