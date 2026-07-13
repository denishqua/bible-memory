// React wrapper around laneDefenderEngine — owns the requestAnimationFrame
// loop and per-lane spawn-delay timers, and exposes a render-friendly view of
// the engine's state. All game rules live in the engine; this hook only
// drives time forward and forwards key presses.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LANE_COUNT,
  LANE_KEYS,
  createEngineState,
  getWordProgress,
  handleLaneKey,
  handleWordReachedBottom,
  randomSpawnDelay,
  trySpawn,
  type EngineState,
  type LaneDefenderResult,
  type LaneDefenderStatus,
} from "../lib/laneDefenderEngine";
import type { Token } from "../lib/tokenize";

export interface LaneWordView {
  queueIndex: number;
  raw: string;
  progress: number; // 0 (top) → 1 (firing line)
}

export interface LaneDefenderView {
  lanes: (LaneWordView | null)[];
  livesRemaining: number;
  status: LaneDefenderStatus;
  destroyedCount: number;
  totalWords: number;
  result: LaneDefenderResult | null;
}

function makeView(engine: EngineState, now: number): LaneDefenderView {
  return {
    lanes: engine.lanes.map((word) => {
      if (word === null) return null;
      return {
        queueIndex: word.queueIndex,
        raw: word.token.raw,
        progress: getWordProgress(word, now),
      };
    }),
    livesRemaining: engine.livesRemaining,
    status: engine.status,
    destroyedCount: engine.nextTargetIndex,
    totalWords: engine.queue.length,
    result: engine.result,
  };
}

export function useLaneDefenderSession(tokens: Token[], isCollection: boolean) {
  const engineRef = useRef<EngineState | null>(null);
  // Per-lane timestamp before which an empty lane must not spawn; null means
  // "not scheduled yet" — the frame loop assigns a fresh randomized delay.
  const spawnDueAtRef = useRef<(number | null)[]>(new Array(LANE_COUNT).fill(null));
  const rafRef = useRef<number | null>(null);
  // Bumped on reset so the rAF-loop effect tears down and restarts cleanly.
  const [generation, setGeneration] = useState(0);

  const [view, setView] = useState<LaneDefenderView>(() => {
    const engine = createEngineState(tokens, isCollection);
    engineRef.current = engine;
    return makeView(engine, performance.now());
  });

  const reset = useCallback(() => {
    const engine = createEngineState(tokens, isCollection);
    engineRef.current = engine;
    spawnDueAtRef.current = new Array(LANE_COUNT).fill(null);
    setView(makeView(engine, performance.now()));
    setGeneration((g) => g + 1);
  }, [tokens, isCollection]);

  // If the token stream itself changes (new verse/collection without a
  // remount), start over — skip the initial mount, which already built state.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    reset();
  }, [reset]);

  useEffect(() => {
    const step = (now: number) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (engine.status === "playing") {
        // 1. Words that reached the firing line unshot (may end the run on a
        //    single-verse scope, so this happens before spawning).
        for (let i = 0; i < LANE_COUNT; i++) {
          const word = engine.lanes[i];
          if (word !== null && getWordProgress(word, now) >= 1) {
            handleWordReachedBottom(engine, i);
            spawnDueAtRef.current[i] = null;
          }
        }

        // 2. Streaming spawns into empty lanes after a short randomized delay.
        if (engine.status === "playing") {
          for (let i = 0; i < LANE_COUNT; i++) {
            if (engine.lanes[i] !== null) continue;
            const dueAt = spawnDueAtRef.current[i];
            if (dueAt === null) {
              spawnDueAtRef.current[i] = now + randomSpawnDelay();
            } else if (now >= dueAt && trySpawn(engine, i, now)) {
              spawnDueAtRef.current[i] = null;
            }
            // If the spawn attempt failed (lead cap / queue exhausted) the
            // stale dueAt stays in the past and we simply retry next frame.
          }
        }
      }

      setView(makeView(engine, now));

      if (engine.status === "playing") {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [generation]);

  // Feeds a typed character in: d/f/j/k (either case) fire their lane, every
  // other character is inert.
  const handleKey = useCallback((char: string) => {
    const engine = engineRef.current;
    if (!engine || engine.status !== "playing") return;
    const laneIndex = (LANE_KEYS as readonly string[]).indexOf(char.toLowerCase());
    if (laneIndex === -1) return;
    handleLaneKey(engine, laneIndex);
    // Sync immediately so hits/misses feel instant instead of waiting a frame
    // (and so the terminal state renders even though the loop is stopping).
    setView(makeView(engine, performance.now()));
  }, []);

  return {
    lanes: view.lanes,
    livesRemaining: view.livesRemaining,
    status: view.status,
    destroyedCount: view.destroyedCount,
    totalWords: view.totalWords,
    result: view.result,
    handleKey,
    retry: reset,
  };
}
