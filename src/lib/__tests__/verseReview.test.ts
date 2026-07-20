import { describe, expect, it } from "vitest";
import {
  REFERENCE_DELIMITER_RAW,
  buildVerseReviewTokens,
  referenceHideThreshold,
  shouldHideReference,
} from "../verseReview";

describe("buildVerseReviewTokens", () => {
  it("appends the reference after the verse, separated by a delimiter", () => {
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    // For(0) God(1) \n(2) —reference—(3) \n(4) John(5) 3:16(6)
    expect(tokens.map((t) => t.raw)).toEqual([
      "For",
      "God",
      "\n",
      REFERENCE_DELIMITER_RAW,
      "\n",
      "John",
      "3:16",
    ]);
  });

  it("leaves the verse tokens themselves un-flagged", () => {
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    expect(tokens[0].isReference).toBeUndefined();
    expect(tokens[1].isReference).toBeUndefined();
  });

  it("flags the appended reference WORD tokens as matchable references", () => {
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    const john = tokens.find((t) => t.raw === "John")!;
    const ref = tokens.find((t) => t.raw === "3:16")!;
    expect(john.isReference).toBe(true);
    expect(john.matchable).toBe(true);
    expect(ref.isReference).toBe(true);
    expect(ref.matchable).toBe(true);
    // "3:16" normalizes to "316" (colon stripped like other punctuation), so it
    // is one word: first-letter typing clears it with "3", whole-word with 316.
    expect(ref.normalized).toBe("316");
  });

  it("flags the delimiter as a non-matchable reference marker", () => {
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    const delimiter = tokens.find((t) => t.raw === REFERENCE_DELIMITER_RAW)!;
    expect(delimiter.matchable).toBe(false);
    expect(delimiter.isReference).toBe(true);
    expect(delimiter.isLineBreak).toBeUndefined();
    expect(delimiter.isVerseNumber).toBeUndefined();
  });

  it("returns the verse unchanged when the reference is blank (no delimiter)", () => {
    const tokens = buildVerseReviewTokens("For God", "   ");
    expect(tokens.map((t) => t.raw)).toEqual(["For", "God"]);
    expect(tokens.some((t) => t.isReference)).toBe(false);
  });
});

describe("referenceHideThreshold (ceil 25%)", () => {
  it("rounds up to whole words", () => {
    expect(referenceHideThreshold(10)).toBe(3); // ceil(2.5)
    expect(referenceHideThreshold(8)).toBe(2); // ceil(2.0)
    expect(referenceHideThreshold(1)).toBe(1); // ceil(0.25)
    expect(referenceHideThreshold(4)).toBe(1); // ceil(1.0)
    expect(referenceHideThreshold(5)).toBe(2); // ceil(1.25)
    expect(referenceHideThreshold(0)).toBe(0);
  });
});

describe("shouldHideReference", () => {
  it("hides only once the completed verse words reach the threshold", () => {
    // 10-word verse → hide at 3 completed words.
    expect(shouldHideReference(10, 2)).toBe(false);
    expect(shouldHideReference(10, 3)).toBe(true);
    expect(shouldHideReference(10, 9)).toBe(true);
  });

  it("hides after the first word for short verses", () => {
    expect(shouldHideReference(1, 0)).toBe(false);
    expect(shouldHideReference(1, 1)).toBe(true);
    expect(shouldHideReference(4, 1)).toBe(true);
  });

  it("never hides a verse with no matchable words", () => {
    expect(shouldHideReference(0, 0)).toBe(false);
  });
});
