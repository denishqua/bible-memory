import { describe, expect, it } from "vitest";
import {
  REFERENCE_DELIMITER_RAW,
  buildVerseReviewTokens,
  mergeReferenceNumbers,
  referenceHideThreshold,
  shouldHideReference,
} from "../verseReview";

describe("buildVerseReviewTokens", () => {
  it("appends the reference after the verse, separated by a delimiter", () => {
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    // The reference is recalled digit-by-digit: "3:16" splits into 3, :, 1, 6
    // (punctuation kept as non-typed context) so first-letter typing is 3,1,6.
    expect(tokens.map((t) => t.raw)).toEqual([
      "For",
      "God",
      "\n",
      REFERENCE_DELIMITER_RAW,
      "\n",
      "John",
      "3",
      ":",
      "1",
      "6",
    ]);
  });

  it("leaves the verse tokens themselves un-flagged", () => {
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    expect(tokens[0].isReference).toBeUndefined();
    expect(tokens[1].isReference).toBeUndefined();
  });

  it("flags the appended reference book + digit tokens as matchable references", () => {
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    const john = tokens.find((t) => t.raw === "John")!;
    expect(john.isReference).toBe(true);
    expect(john.matchable).toBe(true);
    expect(john.normalized).toBe("john");
    // Each digit is its own matchable token (recalled 3, then 1, then 6).
    const digits = tokens.filter((t) => /^\d$/.test(t.raw));
    expect(digits.map((t) => t.raw)).toEqual(["3", "1", "6"]);
    for (const d of digits) {
      expect(d.isReference).toBe(true);
      expect(d.matchable).toBe(true);
      expect(d.normalized).toBe(d.raw);
    }
    // The colon is shown as context but never typed.
    const colon = tokens.find((t) => t.raw === ":")!;
    expect(colon.matchable).toBe(false);
    expect(colon.isReference).toBe(true);
  });

  it("splits a chapter:verse-range reference into per-digit tokens (dash not typed)", () => {
    const tokens = buildVerseReviewTokens("word", "Psalm 16:2-3");
    const start = tokens.findIndex((t) => t.raw === REFERENCE_DELIMITER_RAW) + 2;
    const ref = tokens.slice(start);
    expect(ref.map((t) => t.raw)).toEqual(["Psalm", "1", "6", ":", "2", "-", "3"]);
    // Only the book + digits are typed; ":" and "-" are shown, not typed.
    expect(ref.filter((t) => t.matchable).map((t) => t.raw)).toEqual(["Psalm", "1", "6", "2", "3"]);
    expect(ref.filter((t) => !t.matchable).map((t) => t.raw)).toEqual([":", "-"]);
  });

  it("keeps a whitespace-free number group compact via attachNext", () => {
    const tokens = buildVerseReviewTokens("word", "Psalm 16:2-3");
    // "Psalm" is its own chunk → a space follows it (no attach).
    expect(tokens.find((t) => t.raw === "Psalm")!.attachNext).toBeFalsy();
    // Within "16:2-3" every piece but the last attaches to the next.
    const group = tokens.slice(tokens.findIndex((t) => t.raw === "Psalm") + 1);
    expect(group.map((t) => t.attachNext ?? false)).toEqual([true, true, true, true, true, false]);
  });

  it("flags the delimiter as a non-matchable reference divider", () => {
    const tokens = buildVerseReviewTokens("For God", "John 3:16");
    const delimiter = tokens.find((t) => t.raw === REFERENCE_DELIMITER_RAW)!;
    expect(delimiter.matchable).toBe(false);
    expect(delimiter.isReference).toBe(true);
    expect(delimiter.isReferenceDelimiter).toBe(true);
    expect(delimiter.isLineBreak).toBeUndefined();
    expect(delimiter.isVerseNumber).toBeUndefined();
    // The reference's own punctuation is NOT flagged as the divider.
    expect(tokens.find((t) => t.raw === ":")!.isReferenceDelimiter).toBeUndefined();
  });

  it("returns the verse unchanged when the reference is blank (no delimiter)", () => {
    const tokens = buildVerseReviewTokens("For God", "   ");
    expect(tokens.map((t) => t.raw)).toEqual(["For", "God"]);
    expect(tokens.some((t) => t.isReference)).toBe(false);
  });
});

describe("mergeReferenceNumbers (arcade targets)", () => {
  it("merges a reference's digit runs into whole numbers", () => {
    // Arcade plays 16:12-15 as three targets (16, 12, 15), not six digits.
    const merged = mergeReferenceNumbers(buildVerseReviewTokens("word", "Psalm 16:12-15"));
    expect(merged.filter((t) => t.matchable).map((t) => t.raw)).toEqual([
      "word",
      "Psalm",
      "16",
      "12",
      "15",
    ]);
    // The colon and dash remain as non-matchable context.
    expect(merged.filter((t) => !t.matchable && t.isReference).map((t) => t.raw)).toEqual([
      REFERENCE_DELIMITER_RAW,
      ":",
      "-",
    ]);
  });

  it("keeps space-separated numbers apart and leaves the verse untouched", () => {
    const merged = mergeReferenceNumbers(buildVerseReviewTokens("For God", "Ps 16 2"));
    expect(merged.filter((t) => t.matchable).map((t) => t.raw)).toEqual([
      "For",
      "God",
      "Ps",
      "16",
      "2",
    ]);
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
