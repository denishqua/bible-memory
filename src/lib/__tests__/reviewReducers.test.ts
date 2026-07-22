import { describe, expect, it } from "vitest";
import { reduceFirstLetterInput, reduceWholeWordInput, type InternalState } from "../reviewReducers";
import type { WordRuntimeState } from "../../hooks/useReviewSession";

function makeState(tokens: Array<{ raw: string; normalized: string; matchable: boolean; attachNext?: boolean }>): InternalState {
  const words: WordRuntimeState[] = tokens.map((token, index) => ({
    index,
    token: {
      raw: token.raw,
      normalized: token.normalized,
      matchable: token.matchable,
      attachNext: token.attachNext ?? false,
      isReference: false,
    },
    visible: "masked",
    completed: false,
    attempts: 0,
    typedCount: 0,
    revealedCount: 0,
  }));
  return { words, currentIndex: 0 };
}

describe("reviewReducers", () => {
  describe("reduceFirstLetterInput", () => {
    it("advances word on correct first character", () => {
      const initial = makeState([{ raw: "In", normalized: "in", matchable: true }]);
      const next = reduceFirstLetterInput(initial, "i");
      expect(next.words[0].completed).toBe(true);
      expect(next.currentIndex).toBe(1);
    });

    it("increments attempts on wrong character", () => {
      const initial = makeState([{ raw: "In", normalized: "in", matchable: true }]);
      const next = reduceFirstLetterInput(initial, "x");
      expect(next.words[0].completed).toBe(false);
      expect(next.words[0].attempts).toBe(1);
      expect(next.currentIndex).toBe(0);
    });
  });

  describe("reduceWholeWordInput", () => {
    it("accumulates typed characters and completes on space", () => {
      const initial = makeState([
        { raw: "In", normalized: "in", matchable: true },
        { raw: "the", normalized: "the", matchable: true },
      ]);

      let state = reduceWholeWordInput(initial, "i");
      expect(state.words[0].typedCount).toBe(1);
      expect(state.words[0].completed).toBe(false);

      state = reduceWholeWordInput(state, "n");
      expect(state.words[0].typedCount).toBe(2);
      expect(state.words[0].completed).toBe(false);

      state = reduceWholeWordInput(state, " ");
      expect(state.words[0].completed).toBe(true);
      expect(state.currentIndex).toBe(1);
    });

    it("auto-advances on final word without space", () => {
      const initial = makeState([{ raw: "In", normalized: "in", matchable: true }]);
      let state = reduceWholeWordInput(initial, "i");
      state = reduceWholeWordInput(state, "n");
      expect(state.words[0].completed).toBe(true);
      expect(state.currentIndex).toBe(1);
    });
  });
});
