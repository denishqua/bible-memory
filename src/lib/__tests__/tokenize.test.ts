import { describe, expect, it } from "vitest";
import { tokenize } from "../tokenize";

describe("tokenize", () => {
  it("splits a plain sentence into matchable word tokens", () => {
    const tokens = tokenize("For God so loved");
    expect(tokens).toHaveLength(4);
    expect(tokens.map((t) => t.normalized)).toEqual(["for", "god", "so", "loved"]);
    expect(tokens.every((t) => t.matchable)).toBe(true);
  });

  it("strips punctuation from normalized but keeps it in raw", () => {
    const tokens = tokenize("world, believes.");
    expect(tokens[0].raw).toBe("world,");
    expect(tokens[0].normalized).toBe("world");
    expect(tokens[1].raw).toBe("believes.");
    expect(tokens[1].normalized).toBe("believes");
  });

  it("keeps internal hyphens as one token", () => {
    const tokens = tokenize("self-control");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].normalized).toBe("self-control");
    expect(tokens[0].matchable).toBe(true);
  });

  it("keeps internal apostrophes, straight and curly", () => {
    const straight = tokenize("don't")[0];
    expect(straight.normalized).toBe("don't");
    const curly = tokenize("don’t")[0];
    expect(curly.normalized).toBe("don’t");
    expect(curly.matchable).toBe(true);
  });

  it("strips curly double quotes surrounding a word", () => {
    const tokens = tokenize("“Truly, I say”");
    expect(tokens[0].raw).toBe("“Truly,");
    expect(tokens[0].normalized).toBe("truly");
    expect(tokens[2].normalized).toBe("say");
  });

  it("trims edge apostrophes/hyphens so only internal ones survive", () => {
    // U+2018 (left single quote) is stripped outright; the trailing U+2019
    // survives the character strip but must be edge-trimmed.
    const tokens = tokenize("‘self-control’");
    expect(tokens[0].normalized).toBe("self-control");
  });

  it("marks punctuation-only tokens as non-matchable with raw preserved", () => {
    const tokens = tokenize("loved — world");
    expect(tokens).toHaveLength(3);
    expect(tokens[1].raw).toBe("—");
    expect(tokens[1].matchable).toBe(false);
    expect(tokens[1].normalized).toBe("");
  });

  it("emits newline tokens as non-matchable line breaks", () => {
    const tokens = tokenize("The LORD is my shepherd;\nI shall not want.");
    const lineBreak = tokens.find((t) => t.isLineBreak);
    expect(lineBreak).toBeDefined();
    expect(lineBreak!.raw).toBe("\n");
    expect(lineBreak!.matchable).toBe(false);
    expect(lineBreak!.normalized).toBe("");
  });

  it("never emits tokens for plain spaces or tabs", () => {
    const tokens = tokenize("a  b\tc");
    expect(tokens.map((t) => t.raw)).toEqual(["a", "b", "c"]);
  });

  it("treats [N] verse-number markers as non-matchable display tokens", () => {
    const tokens = tokenize("[16] For God");
    expect(tokens[0].raw).toBe("[16]");
    expect(tokens[0].matchable).toBe(false);
    expect(tokens[0].isVerseNumber).toBe(true);
    expect(tokens[1].normalized).toBe("for");
  });

  it("tokenizes numeric words so normalized[0] is a digit (deadlock-prevention case)", () => {
    const twelve = tokenize("12 disciples")[0];
    expect(twelve.matchable).toBe(true);
    expect(twelve.normalized).toBe("12");
    expect(twelve.normalized[0]).toMatch(/\d/);

    const third = tokenize("the 3rd day")[1];
    expect(third.matchable).toBe(true);
    expect(third.normalized).toBe("3rd");
    expect(third.normalized[0]).toBe("3");
  });

  it("returns an empty array for empty or whitespace-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   \t  ")).toEqual([]);
  });
});
