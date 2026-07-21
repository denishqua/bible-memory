// Sorting helpers for the Library table. All pure so they're unit-testable.
//
// Three sortable columns: canonical Bible position (reference), mastery score,
// and review due time. Each comparator sorts ascending; the caller negates the
// result for descending. Score/review comparators take the derived value the
// row already has (score number, dueAt string) rather than recomputing.
import type { Verse } from "../types/verse";

export type SortColumn = "reference" | "score" | "review";
export type SortDirection = "asc" | "desc";

// The 66 books of the Protestant canon, in canonical order. A reference's book
// index into this list drives "where it is in the Bible" sorting.
export const BIBLE_BOOKS: readonly string[] = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew",
  "Mark", "Luke", "John", "Acts", "Romans",
  "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
  "Titus", "Philemon", "Hebrews", "James", "1 Peter",
  "2 Peter", "1 John", "2 John", "3 John", "Jude",
  "Revelation",
];

// Normalize a book name for lookup: lowercase, collapse whitespace, drop
// trailing punctuation. Common alternate spellings map to the canonical name.
function normalizeBookName(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").trim();
  const aliases: Record<string, string> = {
    psalm: "psalms",
    "song of songs": "song of solomon",
    canticles: "song of solomon",
    revelations: "revelation",
    "acts of the apostles": "acts",
  };
  return aliases[key] ?? key;
}

// Book index for each canonical name, built once from BIBLE_BOOKS.
const BOOK_INDEX: Map<string, number> = new Map(
  BIBLE_BOOKS.map((book, i) => [book.toLowerCase(), i]),
);

// Sort key for a reference: its position in the Bible as
// [bookIndex, chapter, verse]. Unknown books sort AFTER every known book (so a
// free-form reference lands at the end) but stay ordered among themselves by
// the original string. Missing chapter/verse count as 0.
export interface ReferenceKey {
  bookIndex: number;
  chapter: number;
  verse: number;
  raw: string;
}

const UNKNOWN_BOOK_INDEX = BIBLE_BOOKS.length;

export function referenceSortKey(reference: string): ReferenceKey {
  const raw = reference.trim();
  // Book name is everything up to the first chapter number; then optional
  // ":verse". Lazy so the book name doesn't swallow the chapter.
  const match = raw.match(/^(.*?)\s+(\d+)(?::(\d+))?/);
  if (!match) {
    return { bookIndex: UNKNOWN_BOOK_INDEX, chapter: 0, verse: 0, raw };
  }
  const book = normalizeBookName(match[1]);
  const index = BOOK_INDEX.get(book) ?? UNKNOWN_BOOK_INDEX;
  return {
    bookIndex: index,
    chapter: Number(match[2]),
    verse: match[3] !== undefined ? Number(match[3]) : 0,
    raw,
  };
}

function compareReference(a: Verse, b: Verse): number {
  const ka = referenceSortKey(a.reference);
  const kb = referenceSortKey(b.reference);
  if (ka.bookIndex !== kb.bookIndex) return ka.bookIndex - kb.bookIndex;
  if (ka.chapter !== kb.chapter) return ka.chapter - kb.chapter;
  if (ka.verse !== kb.verse) return ka.verse - kb.verse;
  // Same book/chapter/verse-start (or both unknown): fall back to the label.
  return ka.raw.localeCompare(kb.raw);
}

// Ascending review order: soonest-due (most overdue) first. Verses that aren't
// scheduled yet (no dueAt — "New") always sort to the END, regardless of
// direction, so the caller keeps them out of the way in both toggles.
function reviewRank(verse: Verse): number | null {
  return verse.dueAt !== undefined ? new Date(verse.dueAt).getTime() : null;
}

// Sort verses by the given column/direction. Score comes from the scores lookup
// (0 when a verse has no qualifying reviews). Returns a new array; the input is
// left untouched. Unscheduled verses stay pinned to the bottom for the review
// sort in both directions.
export function sortVerses(
  verses: Verse[],
  scoreOf: (id: string) => number,
  column: SortColumn,
  direction: SortDirection,
): Verse[] {
  const factor = direction === "asc" ? 1 : -1;
  const copy = [...verses];

  copy.sort((a, b) => {
    if (column === "reference") {
      return factor * compareReference(a, b);
    }
    if (column === "score") {
      const diff = scoreOf(a.id) - scoreOf(b.id);
      return diff !== 0 ? factor * diff : compareReference(a, b);
    }
    // review
    const ra = reviewRank(a);
    const rb = reviewRank(b);
    if (ra === null && rb === null) return compareReference(a, b);
    if (ra === null) return 1; // a unscheduled → after b
    if (rb === null) return -1; // b unscheduled → after a
    return ra !== rb ? factor * (ra - rb) : compareReference(a, b);
  });

  return copy;
}
