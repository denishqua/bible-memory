import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCollections } from "../../hooks/useCollections";
import { useVerses } from "../../hooks/useVerses";
import { useReviewHistory } from "../../hooks/useReviewHistory";
import { computeVerseScores } from "../../lib/verseScore";
import { Button } from "../ui/Button";
import { VerseList } from "../library/VerseList";
import { AddToCollectionDialog } from "../library/AddToCollectionDialog";
import type { Verse } from "../../types/verse";

interface CollectionDetailProps {
  collectionId: string;
}

export function CollectionDetail({ collectionId }: CollectionDetailProps) {
  const {
    collections,
    loading: collectionsLoading,
    getVerseIdsForCollection,
    removeVerseFromCollection,
    renameCollection,
  } = useCollections();
  const { verses, loading: versesLoading, deleteVerse } = useVerses();
  const { sessions } = useReviewHistory();
  const scores = useMemo(() => computeVerseScores(sessions), [sessions]);

  // Selection is tracked as the set of selected verse IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [prevCollectionId, setPrevCollectionId] = useState<string | null>(null);

  // Inline collection-name editing. `nameDraft` is non-null only while the
  // rename field is open.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [addingToCollection, setAddingToCollection] = useState<Verse | null>(null);

  const collection = collections.find((c) => c.id === collectionId);

  // In collection order (addedAt ascending)
  const orderedVerseIds = getVerseIdsForCollection(collectionId);
  const versesById = new Map(verses.map((v) => [v.id, v] as const));
  const collectionVerses = orderedVerseIds
    .map((id) => versesById.get(id))
    .filter((v): v is Verse => v !== undefined);

  if (collectionId !== prevCollectionId) {
    setPrevCollectionId(collectionId);
    setHasInitializedSelection(false);
  }

  // Initialize selected IDs to all verses in the collection once loaded
  useEffect(() => {
    if (!collectionsLoading && !versesLoading && !hasInitializedSelection && collection) {
      setSelectedIds(new Set(collectionVerses.map((v) => v.id)));
      setHasInitializedSelection(true);
    }
  }, [collectionsLoading, versesLoading, collectionId, collectionVerses, hasInitializedSelection, collection]);

  if (collectionsLoading || versesLoading) {
    return <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>;
  }

  if (!collection) {
    return (
      <div>
        <p style={{ color: "var(--color-ink-muted)" }}>Collection not found.</p>
        <Link to="/collections">Back to Collections</Link>
      </div>
    );
  }

  const commitName = async () => {
    const next = (nameDraft ?? "").trim();
    setNameDraft(null);
    // Ignore an empty name or a no-op rename.
    if (!next || next === collection.name) return;
    await renameCollection(collection.id, next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        {nameDraft === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h2>{collection.name}</h2>
            <Button
              variant="ghost"
              onClick={() => setNameDraft(collection.name)}
              title="Rename collection"
            >
              Rename
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="text"
              value={nameDraft}
              autoFocus
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void commitName();
                if (event.key === "Escape") setNameDraft(null);
              }}
              aria-label="Collection name"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.5rem",
                padding: "0.15rem 0.5rem",
                border: "1px solid var(--color-border)",
                borderRadius: "0.375rem",
                background: "var(--color-surface)",
                color: "var(--color-ink)",
              }}
            />
            <Button variant="primary" onClick={() => void commitName()}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setNameDraft(null)}>
              Cancel
            </Button>
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link to={`/add?collectionId=${collectionId}`} style={{ textDecoration: "none" }}>
            <Button variant="secondary">+ Add Verse</Button>
          </Link>
        </div>
      </div>

      {collectionVerses.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted)" }}>
          No verses in this collection yet. Use "+ Add Verse" above, or add existing verses
          from the Library using "Add to Collection."
        </p>
      ) : (
        <VerseList
          verses={collectionVerses}
          scores={scores}
          onDelete={deleteVerse}
          onAddToCollection={(verse) => setAddingToCollection(verse)}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          collectionId={collectionId}
          onRemoveFromCollection={(verseId) => removeVerseFromCollection(collectionId, verseId)}
        />
      )}

      {addingToCollection ? (
        <AddToCollectionDialog
          verseId={addingToCollection.id}
          verseReference={addingToCollection.reference}
          onClose={() => setAddingToCollection(null)}
        />
      ) : null}
    </div>
  );
}
