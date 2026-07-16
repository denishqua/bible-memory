import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { perVerseAccuracy, useReviewSession } from "../useReviewSession";
import { tokenize, type Token } from "../../lib/tokenize";

function setup(
  text: string,
  mode: "type-it" | "memorize-it" | "master-it" = "type-it",
  requireWholeWord = false,
) {
  return renderHook(() => useReviewSession(tokenize(text), mode, requireWholeWord));
}

// A bulk-review reference marker: non-matchable, and NOT a line break or verse
// number — exactly the boundary token buildCollectionReviewTokens splices in.
function referenceMarker(reference: string): Token {
  return { raw: `— ${reference} —`, matchable: false, normalized: "" };
}

describe("useReviewSession", () => {
  it("starts in progress at the first matchable token with 100% accuracy", () => {
    const { result } = setup("For God so loved");
    expect(result.current.status).toBe("in-progress");
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.accuracy).toBe(100); // nothing engaged yet → empty-set 100
    expect(result.current.words.every((w) => !w.completed && w.attempts === 0)).toBe(true);
  });

  it("advances and counts a correct first-letter keystroke", () => {
    const { result } = setup("For God");
    act(() => result.current.handleKeyPress("f"));
    expect(result.current.words[0].completed).toBe(true);
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.accuracy).toBe(100); // 1 engaged word, clean → 100
  });

  it("accepts the correct letter case-insensitively", () => {
    const { result } = setup("For God");
    act(() => result.current.handleKeyPress("F"));
    expect(result.current.words[0].completed).toBe(true);
  });

  it("counts a wrong keystroke as an attempt without advancing", () => {
    const { result } = setup("For God");
    act(() => result.current.handleKeyPress("x"));
    expect(result.current.words[0].completed).toBe(false);
    expect(result.current.words[0].attempts).toBe(1);
    expect(result.current.currentIndex).toBe(0);
    // Live: 1 word engaged, 0 clean → 0% (only the touched word counts).
    expect(result.current.accuracy).toBe(0);

    act(() => result.current.handleKeyPress("f"));
    expect(result.current.accuracy).toBe(0); // completing it doesn't un-mark it wrong
    expect(result.current.currentIndex).toBe(1);
  });

  it("live accuracy: first word wrong then second word correct → 50%", () => {
    const { result } = setup("For God");
    act(() => result.current.handleKeyPress("x")); // word 0 wrong
    act(() => result.current.handleKeyPress("f")); // word 0 now completed (dirty)
    expect(result.current.accuracy).toBe(0); // 1 engaged, 0 clean
    act(() => result.current.handleKeyPress("g")); // word 1 clean
    // 2 engaged (1 dirty, 1 clean) → 50%.
    expect(result.current.accuracy).toBe(50);
  });

  it("counts a repeatedly-missed word as wrong only once (not double-punished)", () => {
    const { result } = setup("For God");
    // Miss the first word three times, then get it right.
    act(() => result.current.handleKeyPress("x"));
    act(() => result.current.handleKeyPress("y"));
    act(() => result.current.handleKeyPress("z"));
    expect(result.current.words[0].attempts).toBe(3);
    // Live: only word 0 engaged and it's dirty → 0% (repeats still count once).
    expect(result.current.accuracy).toBe(0);
    act(() => result.current.handleKeyPress("f"));
    // Finish the (clean) second word — final score is 1 wrong of 2 words.
    act(() => result.current.handleKeyPress("g"));
    expect(result.current.status).toBe("complete");
    // At completion all matchable words are engaged, so live == overall = 50%.
    expect(result.current.accuracy).toBe(50);
  });

  it("ignores named non-character keys entirely (no attempts, no keystrokes)", () => {
    const { result } = setup("For God");
    act(() => result.current.handleKeyPress("Shift"));
    act(() => result.current.handleKeyPress("Backspace"));
    act(() => result.current.handleKeyPress("ArrowLeft"));
    expect(result.current.words[0].attempts).toBe(0);
    expect(result.current.accuracy).toBe(100); // no words wrong
    expect(result.current.currentIndex).toBe(0);
  });

  it("auto-skips non-matchable tokens on init", () => {
    const { result } = setup("[16] For God");
    // Token 0 is the verse-number marker; the session must not wait on it.
    expect(result.current.currentIndex).toBe(1);
  });

  it("auto-skips non-matchable tokens between words (line breaks)", () => {
    const { result } = setup("For God\nso loved");
    // tokens: For(0) God(1) \n(2) so(3) loved(4)
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.handleKeyPress("g"));
    expect(result.current.currentIndex).toBe(3); // skipped the line break
  });

  it("accepts a digit keystroke for a numeric word", () => {
    const { result } = setup("12 disciples");
    act(() => result.current.handleKeyPress("1"));
    expect(result.current.words[0].completed).toBe(true);
    expect(result.current.currentIndex).toBe(1);
  });

  it("completes past trailing non-matchable tokens", () => {
    const { result } = setup("loved —");
    act(() => result.current.handleKeyPress("l"));
    expect(result.current.status).toBe("complete");
  });

  it("flips to complete after the last word and ignores further keystrokes", () => {
    const { result } = setup("For God");
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.handleKeyPress("g"));
    expect(result.current.status).toBe("complete");

    act(() => result.current.handleKeyPress("z"));
    expect(result.current.accuracy).toBe(100); // no words wrong, post-complete keys ignored
  });

  it("assigns per-mode initial visibility to the runtime words", () => {
    const { result } = setup("For God so loved", "memorize-it");
    expect(result.current.words.map((w) => w.visible)).toEqual([
      "full",
      "masked",
      "full",
      "masked",
    ]);
    const master = setup("For God", "master-it");
    expect(master.result.current.words.every((w) => w.visible === "masked")).toBe(true);
  });

  it("reset restores a fresh session with no carried-over progress", () => {
    const { result } = setup("For God");
    act(() => result.current.handleKeyPress("x"));
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.reset());
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.status).toBe("in-progress");
    expect(result.current.accuracy).toBe(100); // attempts cleared
    expect(result.current.words[0].completed).toBe(false);
    expect(result.current.words[0].attempts).toBe(0);
  });

  it("perVerseAccuracy segments at reference markers with per-verse live scores", () => {
    // Two verses joined by a reference marker: For God — <marker> — so loved.
    // tokens: For(0) God(1) marker(2) so(3) loved(4)
    const tokens = [...tokenize("For God"), referenceMarker("B 2:2"), ...tokenize("so loved")];
    const { result } = renderHook(() => useReviewSession(tokens, "type-it"));

    // Verse 1: word 0 clean, word 1 dirty-then-complete → 1 clean of 2 = 50%.
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.handleKeyPress("x"));
    act(() => result.current.handleKeyPress("g"));
    // Verse 2: both clean → 100%.
    act(() => result.current.handleKeyPress("s"));
    act(() => result.current.handleKeyPress("l"));

    expect(result.current.status).toBe("complete");
    expect(perVerseAccuracy(result.current.words)).toEqual([
      { startIndex: 0, accuracy: 50 },
      { startIndex: 2, accuracy: 100 },
    ]);
  });

  it("perVerseAccuracy leaves not-yet-engaged verses at empty-set 100%", () => {
    const tokens = [...tokenize("For God"), referenceMarker("B 2:2"), ...tokenize("so loved")];
    const { result } = renderHook(() => useReviewSession(tokens, "type-it"));
    // Engage only the first verse's first word (wrong).
    act(() => result.current.handleKeyPress("z"));
    expect(perVerseAccuracy(result.current.words)).toEqual([
      { startIndex: 0, accuracy: 0 }, // 1 engaged, dirty
      { startIndex: 2, accuracy: 100 }, // untouched → empty-set 100
    ]);
  });

  it("whole-word mode: typing every letter completes and advances the word", () => {
    const { result } = setup("For God", "type-it", true);
    act(() => result.current.handleKeyPress("f"));
    expect(result.current.words[0].completed).toBe(false); // not done after one letter
    expect(result.current.words[0].typedCount).toBe(1);
    expect(result.current.currentIndex).toBe(0);

    act(() => result.current.handleKeyPress("o"));
    act(() => result.current.handleKeyPress("r"));
    expect(result.current.words[0].completed).toBe(true);
    expect(result.current.currentIndex).toBe(1); // advanced to the next word
  });

  it("whole-word mode: a wrong letter bumps attempts without advancing", () => {
    const { result } = setup("For God", "type-it", true);
    act(() => result.current.handleKeyPress("x")); // expected 'f'
    expect(result.current.words[0].attempts).toBe(1);
    expect(result.current.words[0].typedCount).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.accuracy).toBe(0); // engaged & dirty

    // Correct letters still work afterward; the word stays marked wrong.
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.handleKeyPress("o"));
    act(() => result.current.handleKeyPress("r"));
    expect(result.current.words[0].completed).toBe(true);
    expect(result.current.words[0].attempts).toBe(1);
    expect(result.current.currentIndex).toBe(1);
  });

  it("whole-word mode: a wrong keystroke reveals one more hint letter", () => {
    const { result } = setup("For God", "type-it", true);
    expect(result.current.words[0].revealedCount).toBe(0);
    act(() => result.current.handleKeyPress("x")); // miss on "For" (expected 'f')
    expect(result.current.words[0].revealedCount).toBe(1);
    expect(result.current.words[0].typedCount).toBe(0);
  });

  it("whole-word mode: repeated misses keep revealing further letters, capped at length", () => {
    const { result } = setup("For God", "type-it", true); // "For" has 3 letters
    act(() => result.current.handleKeyPress("x"));
    act(() => result.current.handleKeyPress("y"));
    act(() => result.current.handleKeyPress("z"));
    expect(result.current.words[0].revealedCount).toBe(3); // fully revealed
    // A further miss can't push the frontier past the word length.
    act(() => result.current.handleKeyPress("q"));
    expect(result.current.words[0].revealedCount).toBe(3);
    expect(result.current.words[0].attempts).toBe(4); // attempts still climb
  });

  it("whole-word mode: the reveal frontier advances from wherever typing is stuck", () => {
    const { result } = setup("For God", "type-it", true);
    act(() => result.current.handleKeyPress("f")); // typedCount 1, revealedCount 0
    act(() => result.current.handleKeyPress("x")); // miss at position 1 → reveal one past typed
    expect(result.current.words[0].typedCount).toBe(1);
    expect(result.current.words[0].revealedCount).toBe(2); // max(0,1)+1
  });

  it("first-letter mode: misses never set revealedCount", () => {
    const { result } = setup("For God"); // whole-word off
    act(() => result.current.handleKeyPress("x"));
    act(() => result.current.handleKeyPress("y"));
    expect(result.current.words[0].revealedCount).toBe(0);
    expect(result.current.words[0].attempts).toBe(2);
  });
});
