import type { Verse } from "../../types/verse";
import { VerseCard } from "./VerseCard";

interface VerseListProps {
  verses: Verse[];
  onDelete: (id: string) => void;
  onAddToCollection: (verse: Verse) => void;
}

export function VerseList({ verses, onDelete, onAddToCollection }: VerseListProps) {
  if (verses.length === 0) {
    return (
      <p style={{ color: "var(--color-ink-muted)" }}>
        No verses yet. Add your first verse to start memorizing.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "1rem",
      }}
    >
      {verses.map((verse) => (
        <VerseCard
          key={verse.id}
          verse={verse}
          onDelete={onDelete}
          onAddToCollection={onAddToCollection}
        />
      ))}
    </div>
  );
}
