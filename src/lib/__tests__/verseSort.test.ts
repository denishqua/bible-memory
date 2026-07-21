import { describe, expect, it } from "vitest";
import { referenceSortKey, sortVerses } from "../verseSort";
import type { Verse } from "../../types/verse";

let counter = 0;
function verse(reference: string, overrides: Partial<Verse> = {}): Verse {
  counter += 1;
  return {
    id: `v${counter}`,
    reference,
    text: "text",
    translation: "ESV",
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const noScores = () => 0;

describe("referenceSortKey", () => {
  it("maps books to their canonical Bible position", () => {
    expect(referenceSortKey("Genesis 1:1").bookIndex).toBe(0);
    expect(referenceSortKey("Revelation 22:21").bookIndex).toBe(65);
    expect(referenceSortKey("Matthew 5:3").bookIndex).toBe(39);
  });

  it("parses numbered books and multi-word books", () => {
    expect(referenceSortKey("1 John 4:8").bookIndex).toBe(referenceSortKey("Jude 1:3").bookIndex - 3);
    expect(referenceSortKey("Song of Solomon 2:1").chapter).toBe(2);
  });

  it("reads chapter and verse start", () => {
    const key = referenceSortKey("Psalm 23:4-6");
    expect(key.chapter).toBe(23);
    expect(key.verse).toBe(4);
  });

  it("normalizes common alternate spellings", () => {
    expect(referenceSortKey("Psalm 1:1").bookIndex).toBe(referenceSortKey("Psalms 1:1").bookIndex);
    expect(referenceSortKey("Song of Songs 1:1").bookIndex).toBe(
      referenceSortKey("Song of Solomon 1:1").bookIndex,
    );
  });

  it("sorts unknown books after every known book", () => {
    expect(referenceSortKey("Hesitations 1:1").bookIndex).toBeGreaterThan(
      referenceSortKey("Revelation 1:1").bookIndex,
    );
  });
});

describe("sortVerses by reference", () => {
  it("orders Genesis → Revelation ascending, then chapter, then verse", () => {
    const verses = [
      verse("John 3:16"),
      verse("Genesis 1:1"),
      verse("Psalm 23:4"),
      verse("Psalm 23:1"),
      verse("Psalm 1:1"),
    ];
    const sorted = sortVerses(verses, noScores, "reference", "asc").map((v) => v.reference);
    expect(sorted).toEqual(["Genesis 1:1", "Psalm 1:1", "Psalm 23:1", "Psalm 23:4", "John 3:16"]);
  });

  it("reverses for descending", () => {
    const verses = [verse("Genesis 1:1"), verse("John 3:16")];
    const sorted = sortVerses(verses, noScores, "reference", "desc").map((v) => v.reference);
    expect(sorted).toEqual(["John 3:16", "Genesis 1:1"]);
  });
});

describe("sortVerses by score", () => {
  it("orders by the provided score", () => {
    const a = verse("Genesis 1:1");
    const b = verse("Exodus 1:1");
    const c = verse("Leviticus 1:1");
    const scoreOf = (id: string) => ({ [a.id]: 50, [b.id]: 90, [c.id]: 10 })[id] ?? 0;
    expect(sortVerses([a, b, c], scoreOf, "score", "asc").map((v) => v.id)).toEqual([c.id, a.id, b.id]);
    expect(sortVerses([a, b, c], scoreOf, "score", "desc").map((v) => v.id)).toEqual([b.id, a.id, c.id]);
  });
});

describe("sortVerses by review due time", () => {
  it("orders soonest-due first and pins unscheduled verses to the bottom in both directions", () => {
    const soon = verse("Genesis 1:1", { dueAt: "2026-01-01T00:00:00.000Z", srsBucket: 1 });
    const later = verse("Exodus 1:1", { dueAt: "2026-06-01T00:00:00.000Z", srsBucket: 2 });
    const unscheduled = verse("Leviticus 1:1"); // no dueAt → New

    const asc = sortVerses([later, unscheduled, soon], noScores, "review", "asc").map((v) => v.id);
    expect(asc).toEqual([soon.id, later.id, unscheduled.id]);

    const desc = sortVerses([later, unscheduled, soon], noScores, "review", "desc").map((v) => v.id);
    expect(desc).toEqual([later.id, soon.id, unscheduled.id]);
  });
});
