import type { Collection } from "../../types/collection";
import { CollectionCard } from "./CollectionCard";

interface CollectionListProps {
  collections: Collection[];
  getVerseCount: (collectionId: string) => number;
  onDelete: (id: string) => void;
}

export function CollectionList({ collections, getVerseCount, onDelete }: CollectionListProps) {
  if (collections.length === 0) {
    return (
      <p style={{ color: "var(--color-ink-muted)" }}>
        No collections yet. Create one to group verses for review.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "1rem",
      }}
    >
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          verseCount={getVerseCount(collection.id)}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
