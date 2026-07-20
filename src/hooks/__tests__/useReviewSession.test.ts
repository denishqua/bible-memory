import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { perVerseAccuracy, useReviewSession } from "../useReviewSession";
import { tokenize, type Token } from "../../lib/tokenize";
import { buildVerseReviewTokens } from "../../lib/verseReview";

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

  it("whole-word mode: a finished word waits for space, then space advances", () => {
    const { result } = setup("For God", "type-it", true);
    act(() => result.current.handleKeyPress("f"));
    expect(result.current.words[0].completed).toBe(false); // not done after one letter
    expect(result.current.words[0].typedCount).toBe(1);
    expect(result.current.currentIndex).toBe(0);

    act(() => result.current.handleKeyPress("o"));
    act(() => result.current.handleKeyPress("r"));
    // Every letter typed, but the word stays current until space commits it —
    // "For" is not the last word, so its final letter does not auto-advance.
    expect(result.current.words[0].typedCount).toBe(3);
    expect(result.current.words[0].completed).toBe(false);
    expect(result.current.currentIndex).toBe(0);

    act(() => result.current.handleKeyPress(" "));
    expect(result.current.words[0].completed).toBe(true);
    expect(result.current.currentIndex).toBe(1); // space advanced to the next word
  });

  it("whole-word mode: space on an empty or half-typed word is ignored", () => {
    const { result } = setup("For God", "type-it", true);
    // Leading space with nothing typed: a no-op, never a miss.
    act(() => result.current.handleKeyPress(" "));
    expect(result.current.words[0].attempts).toBe(0);
    expect(result.current.words[0].typedCount).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.accuracy).toBe(100); // nothing engaged

    // Space part-way through the word is ignored too (only "f" is typed).
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.handleKeyPress(" "));
    expect(result.current.words[0].attempts).toBe(0);
    expect(result.current.words[0].typedCount).toBe(1);
    expect(result.current.currentIndex).toBe(0);
  });

  it("whole-word mode: the final word auto-completes on its last letter (no trailing space)", () => {
    const { result } = setup("For God", "type-it", true);
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.handleKeyPress("o"));
    act(() => result.current.handleKeyPress("r"));
    act(() => result.current.handleKeyPress(" ")); // advance off the first word
    // "God" is the last matchable word — its final letter finishes the session
    // without needing a trailing space.
    act(() => result.current.handleKeyPress("g"));
    act(() => result.current.handleKeyPress("o"));
    act(() => result.current.handleKeyPress("d"));
    expect(result.current.words[1].completed).toBe(true);
    expect(result.current.status).toBe("complete");
  });

  it("whole-word mode: the last matchable word before trailing punctuation auto-completes", () => {
    // "loved —": the em-dash is a non-matchable trailing token, so "loved" is
    // effectively the last word and completes without a space.
    const { result } = setup("loved —", "type-it", true);
    for (const ch of "loved") {
      act(() => result.current.handleKeyPress(ch));
    }
    expect(result.current.status).toBe("complete");
  });

  it("whole-word mode: typing on past a finished word (no space) counts as a miss", () => {
    const { result } = setup("For God", "type-it", true);
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.handleKeyPress("o"));
    act(() => result.current.handleKeyPress("r"));
    // Typing the next word's letter instead of space marks the finished word
    // wrong — forgetting the space is a typing error, and it stays put.
    act(() => result.current.handleKeyPress("g"));
    expect(result.current.words[0].attempts).toBe(1);
    expect(result.current.words[0].completed).toBe(false);
    expect(result.current.currentIndex).toBe(0);
  });

  it("whole-word mode: a wrong letter bumps attempts without advancing", () => {
    const { result } = setup("For God", "type-it", true);
    act(() => result.current.handleKeyPress("x")); // expected 'f'
    expect(result.current.words[0].attempts).toBe(1);
    expect(result.current.words[0].typedCount).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.accuracy).toBe(0); // engaged & dirty

    // Correct letters still work afterward; the word stays marked wrong. "For"
    // is not the last word, so space is what finally commits and advances it.
    act(() => result.current.handleKeyPress("f"));
    act(() => result.current.handleKeyPress("o"));
    act(() => result.current.handleKeyPress("r"));
    act(() => result.current.handleKeyPress(" "));
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

  it("forces the appended reference words masked even in Type It (verse visible)", () => {
    // Verse "For God" is Type It (all visible); the appended reference "John
    // 3:16" must be masked regardless so it's a genuine recall challenge. The
    // reference is split into per-digit tokens (John, 3, 1, 6).
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    const { result } = renderHook(() => useReviewSession(tokens, "type-it"));
    const visibilityByRaw = new Map(
      result.current.words.map((w) => [w.token.raw, w.visible] as const),
    );
    expect(visibilityByRaw.get("For")).toBe("full");
    expect(visibilityByRaw.get("God")).toBe("full");
    expect(visibilityByRaw.get("John")).toBe("masked");
    expect(visibilityByRaw.get("3")).toBe("masked");
    expect(visibilityByRaw.get("1")).toBe("masked");
    expect(visibilityByRaw.get("6")).toBe("masked");
  });

  it("counts the appended reference words in accuracy (no special-casing)", () => {
    // "For" verse (1 word) + "John 3:16" reference (John,3,1,6 = 4 words) = 5
    // matchable words. One miss on the reference drops accuracy to 4/5 = 80%.
    const tokens = buildVerseReviewTokens("For", "John 3:16");
    const { result } = renderHook(() => useReviewSession(tokens, "type-it"));
    act(() => result.current.handleKeyPress("f")); // verse "For" clean
    act(() => result.current.handleKeyPress("x")); // miss on "John"
    act(() => result.current.handleKeyPress("j")); // "John" now dirty-complete
    act(() => result.current.handleKeyPress("3")); // digit 3 clean (colon auto-skipped)
    act(() => result.current.handleKeyPress("1")); // digit 1 clean
    act(() => result.current.handleKeyPress("6")); // digit 6 clean → session complete
    expect(result.current.status).toBe("complete");
    expect(result.current.accuracy).toBe(80); // 4 clean of 5 matchable words
  });

  it("first-letter mode: misses never set revealedCount", () => {
    const { result } = setup("For God"); // whole-word off
    act(() => result.current.handleKeyPress("x"));
    act(() => result.current.handleKeyPress("y"));
    expect(result.current.words[0].revealedCount).toBe(0);
    expect(result.current.words[0].attempts).toBe(2);
  });
});
