export interface Verse {
  id: string;
  reference: string; // "Psalm 23:1-3" — display label
  text: string; // cleaned text, poetry line breaks preserved as "\n"
  translation: string; // "ESV", configurable/extensible
  source: "esv-api" | "manual";
  createdAt: string; // ISO 8601
  updatedAt: string;
  // Spaced repetition (SRS) Leitner scheduling fields:
  dueAt?: string; // ISO timestamp when verse is next due for review
  srsBucket?: number; // Leitner bucket (0 to 5)
}

export type NewVerseInput = Pick<Verse, "reference" | "text" | "translation" | "source">;
export type EditVerseInput = Pick<Verse, "reference" | "text" | "translation">;
