// Pure game logic for Verse Defender (tower-defense asteroids) — no React, no
// DOM, no timers. The hook (useVerseDefenderSession.ts) owns the
// requestAnimationFrame loop and feeds elapsed time / keystrokes into the
// pure transition functions here, mirroring how useReviewSession.ts keeps
// reviewModes.ts/tokenize.ts DOM-free.

import { isBetweenVerseReferenceMarker, type Token } from "./tokenize";
import { charsMatch } from "./keyboard";
import type { ReviewResult } from "../types/review";
import { countPassageVerses } from "./verseReview";

/** How long an asteroid takes to fall from deep space to the base. */
export const DESCENT_DURATION_MS = 6000;

/**
 * Shields (lives) contributed by each Bible verse to a SINGLE SHARED POOL for
 * the whole run. The pool is `SHIELDS_PER_VERSE × verseCount` and is NOT
 * refilled between verses — shields carry over and deplete across the entire
 * run. verseCount is the number of Bible verses in scope: a 3-verse passage
 * (Ephesians 2:8-10) → 6, a 5-verse collection → 10 shared across all 5.
 */
export const SHIELDS_PER_VERSE = 2;

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
  /** Total shield pool for the whole run (SHIELDS_PER_VERSE × verse count). */
  maxLives: number;
  livesRemaining: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  /**
   * True once the current target word has had any wrong keystroke or breach.
   * Reset to false when the next word begins. A word is only "correct" (counted
   * toward correctWords) if it was destroyed while still clean — repeated wrong
   * attempts on the same word keep this true but never double-count.
   */
  currentWordDirty: boolean;
  /** Count of words destroyed while clean (no wrong keystroke, no breach). */
  correctWords: number;
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

export function createInitialState(tokens: Token[], isCollection: boolean): VerseDefenderState {
  const queue: Token[] = [];
  const verseBoundaries = new Set<number>();

  for (const token of tokens) {
    if (token.matchable) {
      queue.push(token);
    } else if (isCollection && isBetweenVerseReferenceMarker(token)) {
      // A between-verse "— Romans 8:28 —" marker (the only non-matchable token
      // that is neither a line break nor a verse number) starts a new verse; its
      // queue index is however many matchable tokens preceded it. The predicate's
      // `!isReference` clause excludes the single-verse reference delimiter, which
      // shares this shape but must NOT open a verse (that would inflate the
      // shield pool); its appended words are matchable and join the queue normally.
      verseBoundaries.add(queue.length);
    }
  }

  // Collections: verseBoundaries never includes index 0, so N verses → N-1
  // boundaries → count N. Single-passage scope has no between-verse markers, so
  // its Bible-verse count comes from the appended reference label instead
  // (Ephesians 2:8-10 → 3 verses → 6 shields). Guard the empty queue.
  const verseCount =
    queue.length === 0
      ? 1
      : isCollection
        ? verseBoundaries.size + 1
        : countPassageVerses(tokens);
  const maxLives = SHIELDS_PER_VERSE * verseCount;

  return {
    queue,
    verseBoundaries,
    isCollection,
    currentWordIndex: 0,
    maxLives,
    livesRemaining: maxLives,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    currentWordDirty: false,
    correctWords: 0,
    everRanOutOfLives: false,
    status: queue.length === 0 ? "complete" : "spawning-playing",
  };
}

/**
 * Correct keystroke while playing (asteroid destroyed) OR while breach-paused
 * (successful retype). Advances the queue and completes the session when the
 * queue is exhausted. Shields are a shared pool for the whole run, so they
 * simply carry over unchanged across verse boundaries — no per-verse refill.
 */
function advanceAfterCorrect(state: VerseDefenderState): VerseDefenderState {
  const nextIndex = state.currentWordIndex + 1;
  const counted = {
    totalKeystrokes: state.totalKeystrokes + 1,
    correctKeystrokes: state.correctKeystrokes + 1,
    // The word just destroyed counts as correct only if it was never dirtied
    // (no wrong keystroke, no breach) during its descent.
    correctWords: state.currentWordDirty ? state.correctWords : state.correctWords + 1,
    // Reset for the next word.
    currentWordDirty: false,
  };

  if (nextIndex >= state.queue.length) {
    return { ...state, ...counted, currentWordIndex: nextIndex, status: "complete" };
  }

  return {
    ...state,
    ...counted,
    currentWordIndex: nextIndex,
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
  const isMatch = charsMatch(char, word?.normalized[0]);

  if (isMatch) {
    return advanceAfterCorrect(state);
  }

  return { ...state, totalKeystrokes: state.totalKeystrokes + 1, currentWordDirty: true };
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
    return { ...state, livesRemaining: 0, currentWordDirty: true, status: "failed" };
  }

  const clamped = Math.max(0, lives);
  return {
    ...state,
    livesRemaining: clamped,
    currentWordDirty: true,
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
    correctWords: state.correctWords,
    totalWords: state.queue.length,
    passed,
  };
}
