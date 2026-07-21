import { describe, expect, it } from "vitest";
import {
  buildSessionResult,
  createInitialState,
  handleKeystroke,
  registerBreach,
  SHIELDS_PER_VERSE,
  type VerseDefenderState,
} from "../verseDefenderEngine";
import { getDisplayAccuracy } from "../../types/review";
import { buildVerseReviewTokens, mergeReferenceNumbers } from "../verseReview";

// The arcade feeds createInitialState the mergeReferenceNumbers output (see
// VerseDefenderSession.gameTokens), so tests build the stream the same way.
const arcadeTokens = (text: string, reference: string) =>
  mergeReferenceNumbers(buildVerseReviewTokens(text, reference));

// A word is destroyed by a single correct keystroke matching its first letter
// (the engine only ever matches index 0 of the current target).
function typeCorrect(state: VerseDefenderState): VerseDefenderState {
  const word = state.queue[state.currentWordIndex];
  return handleKeystroke(state, word.normalized[0]);
}

function typeWrong(state: VerseDefenderState): VerseDefenderState {
  const word = state.queue[state.currentWordIndex];
  const wrong = word.normalized[0]?.toLowerCase() === "z" ? "y" : "z";
  return handleKeystroke(state, wrong);
}

// Play the whole queue cleanly (one correct keystroke per word) until terminal.
function playAllClean(state: VerseDefenderState): VerseDefenderState {
  let s = state;
  while (s.status === "spawning-playing" || s.status === "breach-paused") {
    s = typeCorrect(s);
  }
  return s;
}

describe("createInitialState shield budgeting (single passage)", () => {
  it("grants 2 shields for a one-verse reference", () => {
    const state = createInitialState(arcadeTokens("For God so loved", "John 3:16"), false);
    expect(state.maxLives).toBe(SHIELDS_PER_VERSE * 1);
    expect(state.livesRemaining).toBe(SHIELDS_PER_VERSE * 1);
  });

  it("grants 2 shields per Bible verse for a multi-verse passage", () => {
    // Ephesians 2:8-10 is three verses → six shields.
    const state = createInitialState(arcadeTokens("For by grace you have been saved", "Ephesians 2:8-10"), false);
    expect(state.maxLives).toBe(6);
    expect(state.livesRemaining).toBe(6);
  });
});

describe("word-based session scoring", () => {
  const tokens = () => arcadeTokens("For God so loved the world", "John 3:16");

  it("(a) all words destroyed cleanly scores 100%", () => {
    const final = playAllClean(createInitialState(tokens(), false));
    const result = buildSessionResult(final);
    expect(final.status).toBe("complete");
    expect(result.correctWords).toBe(result.totalWords);
    expect(result.totalWords).toBeGreaterThan(0);
    expect(getDisplayAccuracy(result)).toBe(100);
  });

  it("(b) one word fumbled once counts as exactly one miss", () => {
    let s = createInitialState(tokens(), false);
    s = typeWrong(s); // dirty the first word once
    s = playAllClean(s); // then destroy first + remaining words correctly
    const result = buildSessionResult(s);
    const totalWords = result.totalWords!;
    expect(result.correctWords).toBe(totalWords - 1);
    expect(getDisplayAccuracy(result)).toBe(
      Math.round(((totalWords - 1) / totalWords) * 100),
    );
  });

  it("(c) fumbling the same word many times still counts as one incorrect word", () => {
    // Fumble once.
    let once = createInitialState(tokens(), false);
    once = typeWrong(once);
    once = playAllClean(once);
    const onceResult = buildSessionResult(once);

    // Fumble the same first word five times.
    let many = createInitialState(tokens(), false);
    for (let i = 0; i < 5; i++) many = typeWrong(many);
    many = playAllClean(many);
    const manyResult = buildSessionResult(many);

    expect(manyResult.correctWords).toBe(manyResult.totalWords! - 1);
    expect(manyResult.correctWords).toBe(onceResult.correctWords);
    expect(getDisplayAccuracy(manyResult)).toBe(getDisplayAccuracy(onceResult));
  });

  it("(d) a breached word later retyped correctly counts as incorrect", () => {
    let s = createInitialState(tokens(), false);
    // Breach the first word (single verse retains a shield → breach-paused).
    s = registerBreach(s);
    expect(s.status).toBe("breach-paused");
    expect(s.currentWordDirty).toBe(true);
    // Retype it correctly and finish the rest cleanly.
    s = playAllClean(s);
    const result = buildSessionResult(s);
    expect(result.correctWords).toBe(result.totalWords! - 1);
  });

  it("(e) an empty queue scores 100%", () => {
    const final = createInitialState([], false);
    const result = buildSessionResult(final);
    expect(final.status).toBe("complete");
    expect(result.totalWords).toBe(0);
    expect(result.correctWords).toBe(0);
    expect(getDisplayAccuracy(result)).toBe(100);
  });
});
