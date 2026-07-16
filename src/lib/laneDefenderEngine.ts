// Pure game logic for the Lane Defender arcade mode — no React, no DOM.
//
// The verse's matchable tokens form a strict destroy-in-order `queue`. Words
// stream into the 4 lanes as decoys/targets: `spawnPointer` walks the queue
// exactly once ("each word spawns exactly once ever"), while `nextTargetIndex`
// is the ONE word the player must shoot right now to make progress. The single
// invariant everything else serves: the current target is always guaranteed to
// be in flight in some lane — if it isn't (never spawned yet, fell off the
// bottom, or was shot earlier while it was still a decoy), the next lane that
// frees up spawns it specifically, ahead of the normal stream.
//
// There are no lives: the run always plays through to "complete". Scoring is
// per-word — each verse word can be shot cleanly (right lane, before it lands)
// or fumbled (wrong-lane press, or the target falling past unshot). The final
// percentage is cleanWords / totalWords.
import type { Token } from "./tokenize";

export const LANE_COUNT = 4;
// Left-to-right key bindings for the 4 lanes.
export const LANE_KEYS = ["d", "f", "j", "k"] as const;
// How long a word takes to fall from the top of its lane to the firing line.
export const DESCENT_DURATION_MS = 7000;
// Randomized per-lane delay before an empty lane spawns its next word.
export const SPAWN_DELAY_MIN_MS = 200;
export const SPAWN_DELAY_MAX_MS = 900;
// spawnPointer never runs more than this many words ahead of nextTargetIndex —
// with 4 lanes this guarantees a slot is always reachable for the target.
export const MAX_SPAWN_LEAD = 4;
// Runs at or above this percentage count as a pass (same bar as the other
// review modes).
export const PASS_THRESHOLD = 90;

export type LaneDefenderStatus = "playing" | "complete";

export interface FallingWordState {
  queueIndex: number;
  token: Token;
  spawnedAt: number; // performance.now() timestamp at spawn
}

export interface LaneDefenderResult {
  accuracy: number; // 0–100, rounded
  cleanWords: number; // words shot with no mistake charged against them
  totalWords: number;
  passed: boolean; // accuracy >= PASS_THRESHOLD
}

export interface EngineState {
  queue: Token[];
  spawnPointer: number;
  nextTargetIndex: number;
  lanes: (FallingWordState | null)[];
  // Mistakes charged against the score: a wrong-lane press (shooting a decoy)
  // and a target word falling past the firing line unshot. Decoys falling past
  // are normal play and never counted.
  wrongPresses: number;
  droppedTargets: number;
  status: LaneDefenderStatus;
  // Populated exactly once, at the moment status leaves "playing".
  result: LaneDefenderResult | null;
}

// The ordered destroy queue is just the matchable tokens; line breaks,
// verse-number markers, and between-verse reference markers are all skipped.
export function buildQueue(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.matchable);
}

export function createEngineState(tokens: Token[]): EngineState {
  const queue = buildQueue(tokens);
  const state: EngineState = {
    queue,
    spawnPointer: 0,
    nextTargetIndex: 0,
    lanes: new Array<FallingWordState | null>(LANE_COUNT).fill(null),
    wrongPresses: 0,
    droppedTargets: 0,
    status: "playing",
    result: null,
  };
  if (queue.length === 0) {
    // Degenerate input (no matchable words) — nothing to play; complete
    // immediately as a trivially-passed run.
    finalizeComplete(state);
  }
  return state;
}

export function getWordProgress(word: FallingWordState, now: number): number {
  return Math.min(1, Math.max(0, (now - word.spawnedAt) / DESCENT_DURATION_MS));
}

export function isTargetInFlight(state: EngineState): boolean {
  return state.lanes.some((w) => w !== null && w.queueIndex === state.nextTargetIndex);
}

// Attempts to spawn a word into the given (empty) lane. Returns true if a
// word spawned. Priority: if the current target is not in flight anywhere, it
// spawns next — regardless of spawnPointer — so the player is never stuck
// waiting on an off-screen target. Otherwise the stream continues from
// spawnPointer, capped so it never runs more than MAX_SPAWN_LEAD ahead of the
// target.
export function trySpawn(state: EngineState, laneIndex: number, now: number): boolean {
  if (state.status !== "playing") return false;
  if (state.lanes[laneIndex] !== null) return false;

  let queueIndex: number;
  if (!isTargetInFlight(state) && state.nextTargetIndex < state.queue.length) {
    queueIndex = state.nextTargetIndex;
    // Only advance the stream pointer when the target IS the stream head
    // (first-ever spawn of this word); a respawn of an earlier miss leaves
    // the pointer alone.
    if (state.spawnPointer === state.nextTargetIndex) {
      state.spawnPointer += 1;
    }
  } else if (
    state.spawnPointer < state.queue.length &&
    state.spawnPointer - state.nextTargetIndex < MAX_SPAWN_LEAD
  ) {
    queueIndex = state.spawnPointer;
    state.spawnPointer += 1;
  } else {
    return false;
  }

  state.lanes[laneIndex] = {
    queueIndex,
    token: state.queue[queueIndex],
    spawnedAt: now,
  };
  return true;
}

function finalizeComplete(state: EngineState): void {
  state.status = "complete";
  const totalWords = state.queue.length;
  const cleanWords = Math.max(0, totalWords - state.wrongPresses - state.droppedTargets);
  const accuracy = totalWords === 0 ? 100 : Math.round((cleanWords / totalWords) * 100);
  state.result = {
    accuracy,
    cleanWords,
    totalWords,
    passed: accuracy >= PASS_THRESHOLD,
  };
}

export type LaneKeyOutcome = "hit" | "miss" | "empty";

// A D/F/J/K press resolved to a lane. Empty lane: inert. Lane holding the
// target: destroy + advance. Lane holding any other word (a decoy): a
// wrong-lane press — the decoy is used up (never respawns) and one mistake is
// charged against the score.
export function handleLaneKey(state: EngineState, laneIndex: number): LaneKeyOutcome {
  if (state.status !== "playing") return "empty";
  const word = state.lanes[laneIndex];
  if (word === null) return "empty";

  if (word.queueIndex === state.nextTargetIndex) {
    state.lanes[laneIndex] = null;
    state.nextTargetIndex += 1;
    if (state.nextTargetIndex >= state.queue.length) {
      finalizeComplete(state);
    }
    return "hit";
  }

  state.wrongPresses += 1;
  state.lanes[laneIndex] = null;
  return "miss";
}

export type BottomOutcome = "target-miss" | "decoy-despawn" | "none";

// A word's descent finished without being shot. Target: charged as one mistake
// and it will respawn via trySpawn's target guarantee — nextTargetIndex never
// advances here. Decoy: harmless despawn, its one-time spawn is used up.
export function handleWordReachedBottom(state: EngineState, laneIndex: number): BottomOutcome {
  if (state.status !== "playing") return "none";
  const word = state.lanes[laneIndex];
  if (word === null) return "none";

  state.lanes[laneIndex] = null;
  if (word.queueIndex === state.nextTargetIndex) {
    state.droppedTargets += 1;
    return "target-miss";
  }
  return "decoy-despawn";
}

export function randomSpawnDelay(): number {
  return SPAWN_DELAY_MIN_MS + Math.random() * (SPAWN_DELAY_MAX_MS - SPAWN_DELAY_MIN_MS);
}
