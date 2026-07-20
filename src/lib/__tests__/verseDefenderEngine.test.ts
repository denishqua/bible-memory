import { describe, expect, it } from "vitest";
import { createInitialState, SHIELDS_PER_VERSE } from "../verseDefenderEngine";
import { buildVerseReviewTokens, mergeReferenceNumbers } from "../verseReview";

// The arcade feeds createInitialState the mergeReferenceNumbers output (see
// VerseDefenderSession.gameTokens), so tests build the stream the same way.
const arcadeTokens = (text: string, reference: string) =>
  mergeReferenceNumbers(buildVerseReviewTokens(text, reference));

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
