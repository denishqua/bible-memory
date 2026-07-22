import { useCallback, useEffect, useRef, useState } from "react";
import type { Token } from "../lib/tokenize";
import { isPrintableCharacter } from "../lib/keyboard";
import {
  DESCENT_DURATION_MS,
  buildSessionResult,
  clamp01,
  createInitialState,
  getDescentPhase,
  handleKeystroke,
  registerBreach,
  type DescentPhase,
  type LivesResult,
  type VerseDefenderState,
  type VerseDefenderStatus,
} from "../lib/verseDefenderEngine";

/** One destroyed asteroid: `id` increments per hit (animation key), `progress`
 * is where the asteroid was on its descent when the laser connected. */
interface HitEvent {
  id: number;
  progress: number;
}

/** One wrong keystroke: `id` increments per miss (animation key). */
interface MissEvent {
  id: number;
}

interface UseVerseDefenderSessionResult {
  status: VerseDefenderStatus;
  /** The word the in-flight (or breached) asteroid represents; null once done. */
  currentWord: Token | null;
  currentWordIndex: number;
  totalWords: number;
  /** 0..1 descent progress of the current asteroid (frozen at 1 while breached). */
  progress: number;
  phase: DescentPhase;
  livesRemaining: number;
  /** Total shield pool for the whole run. */
  maxLives: number;
  correctKeystrokes: number;
  /** The most recent correct hit — drives the laser/burst effect. */
  lastHit: HitEvent | null;
  /** Most recent wrong keystroke — drives the miss graphic. */
  lastMiss: MissEvent | null;
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
  const [sessionKey, setSessionKey] = useState(0);
  const spawnedAtRef = useRef(0);
  const [lastHit, setLastHit] = useState<HitEvent | null>(null);
  const [lastMiss, setLastMiss] = useState<MissEvent | null>(null);
  const progressRef = useRef(0);

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
  }, [state.status, state.currentWordIndex, sessionKey]);

  const handleKeyPress = useCallback((char: string) => {
    if (!isPrintableCharacter(char)) return;
    setState((prev) => {
      const next = handleKeystroke(prev, char);
      const advanced = next.currentWordIndex > prev.currentWordIndex;
      if (advanced) {
        const hitProgress = prev.status === "breach-paused" ? 1 : progressRef.current;
        setLastHit((h) => ({ id: (h?.id ?? 0) + 1, progress: hitProgress }));
      } else if (
        next.currentWordIndex === prev.currentWordIndex &&
        next.totalKeystrokes > prev.totalKeystrokes
      ) {
        setLastMiss((m) => ({ id: (m?.id ?? 0) + 1 }));
      }
      return next;
    });
  }, []);

  const retry = useCallback(() => {
    setState(createInitialState(tokens, isCollection));
    setProgress(0);
    progressRef.current = 0;
    setLastHit(null);
    setLastMiss(null);
    setSessionKey((k) => k + 1);
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
    maxLives: state.maxLives,
    correctKeystrokes: state.correctKeystrokes,
    lastHit,
    lastMiss,
    result: isDone ? buildSessionResult(state) : null,
    handleKeyPress,
    retry,
  };
}
