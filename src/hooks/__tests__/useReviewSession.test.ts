import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReviewSession } from "../useReviewSession";
import { tokenize } from "../../lib/tokenize";

function setup(text: string, mode: "type-it" | "memorize-it" | "master-it" = "type-it") {
  return renderHook(() => useReviewSession(tokenize(text), mode));
}

describe("useReviewSession", () => {
  it("starts in progress at the first matchable token with 100% accuracy", () => {
    const { result } = setup("For God so loved");
    expect(result.current.status).toBe("in-progress");
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.accuracy).toBe(100); // no words wrong yet
    expect(result.current.words.every((w) => !w.completed && w.attempts === 0)).toBe(true);
  });

  it("advances and counts a correct first-letter keystroke", () => {
    const { result } = setup("For God");
    act(() => result.current.handleKeyPress("f"));
    expect(result.current.words[0].completed).toBe(true);
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.accuracy).toBe(100); // no words wrong
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
    expect(result.current.accuracy).toBe(50); // 1 of 2 words now wrong

    act(() => result.current.handleKeyPress("f"));
    expect(result.current.accuracy).toBe(50); // completing it doesn't un-mark it wrong
    expect(result.current.currentIndex).toBe(1);
  });

  it("counts a repeatedly-missed word as wrong only once (not double-punished)", () => {
    const { result } = setup("For God");
    // Miss the first word three times, then get it right.
    act(() => result.current.handleKeyPress("x"));
    act(() => result.current.handleKeyPress("y"));
    act(() => result.current.handleKeyPress("z"));
    expect(result.current.words[0].attempts).toBe(3);
    expect(result.current.accuracy).toBe(50); // still just 1 of 2 words wrong
    act(() => result.current.handleKeyPress("f"));
    // Finish the (clean) second word — final score is 1 wrong of 2 words.
    act(() => result.current.handleKeyPress("g"));
    expect(result.current.status).toBe("complete");
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
});
