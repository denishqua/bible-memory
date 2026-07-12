export interface Verse {
  id: string;
  reference: string; // "Psalm 23:1-3" — display label
  text: string; // cleaned text, poetry line breaks preserved as "\n"
  translation: string; // "ESV" for now, not hardcoded into logic
  source: "esv-api" | "manual";
  createdAt: string; // ISO 8601
  updatedAt: string;
  // Reserved for a future SRS bolt-on with zero migration:
  dueAt?: string;
  srsBucket?: number;
}
