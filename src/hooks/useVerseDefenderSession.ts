import { useCallback, useEffect, useRef, useState } from "react";
import type { Token } from "../lib/tokenize";
import {
  DESCENT_DURATION_MS,
  buildSessionResult,
  clamp01,
  createInitialState,
  getDescentPhase,
  handleKeystroke,
  isPrintableCharacter,
  registerBreach,
  type DescentPhase,
  type LivesResult,
  type VerseDefenderState,
  type VerseDefenderStatus,
} from "../lib/verseDefenderEngine";

/** One destroyed asteroid: `id` increments per hit (animation key), `progress`
 * is where the asteroid was on its descent when the laser connected. */
export interface HitEvent {
  id: number;
  progress: number;
}

export interface UseVerseDefenderSessionResult {
  status: VerseDefenderStatus;
  /** The word the in-flight (or breached) asteroid represents; null once done. */
  currentWord: Token | null;
  currentWordIndex: number;
  totalWords: number;
  /** 0..1 descent progress of the current asteroid (frozen at 1 while breached). */
  progress: number;
  phase: DescentPhase;
  livesRemaining: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  everRanOutOfLives: boolean;
  /** The most recent correct hit — drives the laser/burst effect. */
  lastHit: HitEvent | null;
  /** Non-null only once status is "complete" or "failed". */
  result: LivesResult | null;
  handleKeyPress: (char: string) => void;
  retry: () => void;
}

// React wrapper around the pure verseDefenderEngine: owns the
// requestAnimationFrame descent loop and translates elapsed time / keystrokes
// into engine state transitions. Deliberately has no knowledge of
// <input>/focus/DOM events — the UI layer owns the hidden focused input and
// calls handleKeyPress from its change events, same split as useReviewSession.
export function useVerseDefenderSession(
  tokens: Token[],
  isCollection: boolean,
): UseVerseDefenderSessionResult {
  const [state, setState] = useState<VerseDefenderState>(() =>
    createInitialState(tokens, isCollection),
  );
  const [progress, setProgress] = useState(0);
  // Bumped on retry() so the descent effect below re-runs even though
  // currentWordIndex/status land back on their initial values.
  const [runId, setRunId] = useState(0);
  const spawnedAtRef = useRef(0);
  const [lastHit, setLastHit] = useState<HitEvent | null>(null);
  // Mirrors the `progress` state so handleKeyPress (a stable callback) can
  // read the asteroid's position at the exact moment of a hit without
  // re-subscribing on every frame.
  const progressRef = useRef(0);

  // Descent loop: one effect run per in-flight asteroid (keyed on
  // currentWordIndex/status). Spawns the asteroid fresh (progress 0, new
  // timestamp), then advances progress every animation frame until it is
  // destroyed (deps change, cleanup cancels the frame) or it breaches
  // (progress hits 1 — freeze there and hand the engine a breach; the paused
  // state never re-derives elapsed time).
  useEffect(() => {
    if (state.status !== "spawning-playing") return;

    spawnedAtRef.current = performance.now();
    setProgress(0);
    progressRef.current = 0;

    let frame = 0;
    const tick = () => {
      const next = clamp01((performance.now() - spawnedAtRef.current) / DESCENT_DURATION_MS);
      setProgress(next);
      progressRef.current = next;
      if (next >= 1) {
        setState(registerBreach);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.status, state.currentWordIndex, runId]);

  const handleKeyPress = useCallback((char: string) => {
    if (!isPrintableCharacter(char)) return;
    setState((prev) => {
      const next = handleKeystroke(prev, char);
      if (next.currentWordIndex > prev.currentWordIndex) {
        // Correct hit — record where the asteroid was so the UI can fire the
        // laser at it. A breach-paused retype hits the asteroid at the base.
        const hitProgress = prev.status === "breach-paused" ? 1 : progressRef.current;
        setLastHit((h) => ({ id: (h?.id ?? 0) + 1, progress: hitProgress }));
      }
      return next;
    });
  }, []);

  const retry = useCallback(() => {
    setState(createInitialState(tokens, isCollection));
    setProgress(0);
    progressRef.current = 0;
    setLastHit(null);
    setRunId((id) => id + 1);
  }, [tokens, isCollection]);

  const isDone = state.status === "complete" || state.status === "failed";

  return {
    status: state.status,
    currentWord: isDone ? null : (state.queue[state.currentWordIndex] ?? null),
    currentWordIndex: state.currentWordIndex,
    totalWords: state.queue.length,
    progress: state.status === "breach-paused" ? 1 : progress,
    phase: getDescentPhase(state.status === "breach-paused" ? 1 : progress),
    livesRemaining: Math.max(0, state.livesRemaining),
    totalKeystrokes: state.totalKeystrokes,
    correctKeystrokes: state.correctKeystrokes,
    everRanOutOfLives: state.everRanOutOfLives,
    lastHit,
    result: isDone ? buildSessionResult(state) : null,
    handleKeyPress,
    retry,
  };
}
