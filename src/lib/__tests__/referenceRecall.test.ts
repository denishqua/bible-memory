import { describe, expect, it } from "vitest";
import {
  matchesReferenceWholeWord,
  normalizeReference,
  referenceFirstLetterSequence,
} from "../referenceRecall";

describe("normalizeReference", () => {
  it("lowercases and collapses punctuation runs to single spaces", () => {
    expect(normalizeReference("John 3:16")).toBe("john 3 16");
  });

  it("trims and collapses extra whitespace", () => {
    expect(normalizeReference("  John   3 : 16 ")).toBe("john 3 16");
  });

  it("treats a hyphenated range's separators as spaces", () => {
    expect(normalizeReference("Psalm 23:1-3")).toBe("psalm 23 1 3");
  });
});

describe("matchesReferenceWholeWord (forgiving)", () => {
  it("ignores case", () => {
    expect(matchesReferenceWholeWord("JOHN 3:16", "John 3:16")).toBe(true);
  });

  it("ignores punctuation differences", () => {
    // The spec's headline example: spaces stand in for the colon.
    expect(matchesReferenceWholeWord("john 3 16", "John 3:16")).toBe(true);
  });

  it("ignores extra and collapsed spacing", () => {
    expect(matchesReferenceWholeWord("  john   3:16  ", "John 3:16")).toBe(true);
  });

  it("still rejects a genuinely different reference", () => {
    expect(matchesReferenceWholeWord("john 3 15", "John 3:16")).toBe(false);
    expect(matchesReferenceWholeWord("mark 3 16", "John 3:16")).toBe(false);
  });

  it("does NOT treat missing separators as equal (3 16 vs 316)", () => {
    // Forgiving about punctuation/space differences, not about token grouping.
    expect(matchesReferenceWholeWord("john 316", "John 3:16")).toBe(false);
  });
});

describe("referenceFirstLetterSequence", () => {
  it("takes the first letter of a word and each digit as its own token", () => {
    expect(referenceFirstLetterSequence("John 3:16")).toEqual(["j", "3", "1", "6"]);
  });

  it("lowercases letters", () => {
    expect(referenceFirstLetterSequence("Psalm 23")).toEqual(["p", "2", "3"]);
  });

  it("handles a leading number in the book name", () => {
    expect(referenceFirstLetterSequence("1 John 4:8")).toEqual(["1", "j", "4", "8"]);
  });

  it("handles hyphenated verse ranges", () => {
    expect(referenceFirstLetterSequence("Psalm 23:1-3")).toEqual(["p", "2", "3", "1", "3"]);
  });

  it("handles multi-word book names", () => {
    expect(referenceFirstLetterSequence("Song of Solomon 1:1")).toEqual([
      "s",
      "o",
      "s",
      "1",
      "1",
    ]);
  });

  it("ignores surrounding whitespace", () => {
    expect(referenceFirstLetterSequence("  Acts 2:42  ")).toEqual(["a", "2", "4", "2"]);
  });
});
