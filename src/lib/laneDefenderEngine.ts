// Pure game logic for the Lane Defender arcade mode — no React, no DOM.
//
// The verse's matchable tokens form a strict destroy-in-order `queue`. Words
// stream into the 4 lanes as decoys/targets: `spawnPointer` walks the queue
// exactly once ("each word spawns exactly once ever"), while `nextTargetIndex`
// is the ONE word the player must shoot right now to make progress. The single
// invariant everything else serves: the current target is always guaranteed to
// be in flight in some lane — if it isn't (never spawned yet, fell off the
// bottom as a miss, or was shot earlier while it was still a decoy), the next
// lane that frees up spawns it specifically, ahead of the normal stream.
import type { Token } from "./tokenize";

export const LANE_COUNT = 4;
// Left-to-right key bindings for the 4 lanes.
export const LANE_KEYS = ["d", "f", "j", "k"] as const;
// How long a word takes to fall from the top of its lane to the firing line.
export const DESCENT_DURATION_MS = 7000;
// Randomized per-lane delay before an empty lane spawns its next word.
export const SPAWN_DELAY_MIN_MS = 200;
export const SPAWN_DELAY_MAX_MS = 900;
export const STARTING_LIVES = 3;
// spawnPointer never runs more than this many words ahead of nextTargetIndex —
// with 4 lanes this guarantees a slot is always reachable for the target.
export const MAX_SPAWN_LEAD = 4;

export type LaneDefenderStatus = "playing" | "complete" | "failed";

export interface FallingWordState {
  queueIndex: number;
  token: Token;
  spawnedAt: number; // performance.now() timestamp at spawn
}

export interface LaneDefenderResult {
  livesRemaining: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  passed: boolean;
}

export interface EngineState {
  queue: Token[];
  // Queue indices where a new verse starts (collection scope only) — crossing
  // one on a correct hit resets lives to STARTING_LIVES.
  verseStartIndices: Set<number>;
  isCollection: boolean;
  spawnPointer: number;
  nextTargetIndex: number;
  lanes: (FallingWordState | null)[];
  livesRemaining: number;
  // Collection scope never ends early on 0 lives — instead this latches true
  // the first time lives bottom out on any verse, and the final `passed`
  // becomes false. Never cleared once set.
  everRanOutOfLives: boolean;
  totalKeystrokes: number;
  correctKeystrokes: number;
  status: LaneDefenderStatus;
  // Populated exactly once, at the moment status leaves "playing".
  result: LaneDefenderResult | null;
}

// Extracts the ordered destroy queue plus verse-boundary indices. A verse
// boundary is signalled in the token stream by collectionReview.ts's
// reference-marker tokens: non-matchable, not a line break, not a verse
// number (e.g. raw "— Romans 8:28 —"). The first matchable token after such a
// marker starts a new verse. Single-verse scope has no markers, so the set
// stays empty.
export function buildQueue(tokens: Token[]): {
  queue: Token[];
  verseStartIndices: Set<number>;
} {
  const queue: Token[] = [];
  const verseStartIndices = new Set<number>();
  let pendingBoundary = false;

  for (const token of tokens) {
    if (token.matchable) {
      if (pendingBoundary && queue.length > 0) {
        verseStartIndices.add(queue.length);
      }
      pendingBoundary = false;
      queue.push(token);
      continue;
    }
    if (!token.isLineBreak && !token.isVerseNumber) {
      // Reference-marker token between verses in a collection stream.
      pendingBoundary = true;
    }
  }

  return { queue, verseStartIndices };
}

export function createEngineState(tokens: Token[], isCollection: boolean): EngineState {
  const { queue, verseStartIndices } = buildQueue(tokens);
  const state: EngineState = {
    queue,
    verseStartIndices,
    isCollection,
    spawnPointer: 0,
    nextTargetIndex: 0,
    lanes: new Array<FallingWordState | null>(LANE_COUNT).fill(null),
    livesRemaining: STARTING_LIVES,
    everRanOutOfLives: false,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
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

// Shared life-loss transition for wrong-lane keypresses and the target
// reaching the bottom unshot. Single-verse scope fails the run outright at 0;
// collection scope clamps at 0, latches everRanOutOfLives, and keeps going.
function applyLifeLoss(state: EngineState): void {
  state.livesRemaining -= 1;
  if (state.livesRemaining > 0) return;
  state.livesRemaining = 0;
  state.everRanOutOfLives = true;
  if (!state.isCollection) {
    state.status = "failed";
    state.result = {
      livesRemaining: 0,
      totalKeystrokes: state.totalKeystrokes,
      correctKeystrokes: state.correctKeystrokes,
      passed: false,
    };
  }
}

function finalizeComplete(state: EngineState): void {
  state.status = "complete";
  state.result = {
    livesRemaining: Math.max(0, state.livesRemaining),
    totalKeystrokes: state.totalKeystrokes,
    correctKeystrokes: state.correctKeystrokes,
    passed: state.isCollection ? !state.everRanOutOfLives : state.livesRemaining > 0,
  };
}

export type LaneKeyOutcome = "hit" | "miss" | "empty";

// A D/F/J/K press resolved to a lane. Empty lane: inert, no penalty. Lane
// holding the target: destroy + advance. Lane holding any other word (a
// decoy): miss — the decoy is used up (never respawns) and a life is lost.
export function handleLaneKey(state: EngineState, laneIndex: number): LaneKeyOutcome {
  if (state.status !== "playing") return "empty";
  const word = state.lanes[laneIndex];
  if (word === null) return "empty";

  if (word.queueIndex === state.nextTargetIndex) {
    state.totalKeystrokes += 1;
    state.correctKeystrokes += 1;
    state.lanes[laneIndex] = null;
    state.nextTargetIndex += 1;
    if (state.nextTargetIndex >= state.queue.length) {
      finalizeComplete(state);
    } else if (state.isCollection && state.verseStartIndices.has(state.nextTargetIndex)) {
      // Fresh verse, fresh lives — same convention as the other arcade mode.
      state.livesRemaining = STARTING_LIVES;
    }
    return "hit";
  }

  state.totalKeystrokes += 1;
  state.lanes[laneIndex] = null;
  applyLifeLoss(state);
  return "miss";
}

export type BottomOutcome = "target-miss" | "decoy-despawn" | "none";

// A word's descent finished without being shot. Target: penalized like a
// wrong-lane miss (no keystroke counted) and it will respawn via trySpawn's
// target guarantee — nextTargetIndex never advances here. Decoy: harmless
// despawn, its one-time spawn is used up.
export function handleWordReachedBottom(state: EngineState, laneIndex: number): BottomOutcome {
  if (state.status !== "playing") return "none";
  const word = state.lanes[laneIndex];
  if (word === null) return "none";

  state.lanes[laneIndex] = null;
  if (word.queueIndex === state.nextTargetIndex) {
    applyLifeLoss(state);
    return "target-miss";
  }
  return "decoy-despawn";
}

export function randomSpawnDelay(): number {
  return SPAWN_DELAY_MIN_MS + Math.random() * (SPAWN_DELAY_MAX_MS - SPAWN_DELAY_MIN_MS);
}
