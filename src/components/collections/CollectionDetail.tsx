import { useCallback, useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCollections } from "../../hooks/useCollections";
import { useVerses } from "../../hooks/useVerses";
import { useReviewHistory } from "../../hooks/useReviewHistory";
import { computeVerseScores } from "../../lib/verseScore";
import { Button } from "../ui/Button";
import { InlineEditInput } from "../ui/InlineEditInput";
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

  // Inline collection-name editing: true when editing is active
  const [isEditingName, setIsEditingName] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState<Verse | null>(null);

  const collection = collections.find((c) => c.id === collectionId);

  // In collection order (addedAt ascending)
  const orderedVerseIds = getVerseIdsForCollection(collectionId);
  const collectionVerses = useMemo(() => {
    const byId = new Map(verses.map((v) => [v.id, v] as const));
    return orderedVerseIds
      .map((id) => byId.get(id))
      .filter((v): v is Verse => v !== undefined);
  }, [orderedVerseIds, verses]);

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

  const commitName = useCallback(
    async (nextName: string) => {
      setIsEditingName(false);
      if (!collection || !nextName || nextName === collection.name) return;
      await renameCollection(collection.id, nextName);
    },
    [collection, renameCollection],
  );

  const handleAddToCollection = useCallback((verse: Verse) => {
    setAddingToCollection(verse);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setAddingToCollection(null);
  }, []);

  const handleRemoveFromCollection = useCallback(
    (verseId: string) => {
      void removeVerseFromCollection(collectionId, verseId);
    },
    [collectionId, removeVerseFromCollection],
  );

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
        {!isEditingName ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h2>{collection.name}</h2>
            <Button
              variant="ghost"
              onClick={() => setIsEditingName(true)}
              title="Rename collection"
            >
              Rename
            </Button>
          </div>
        ) : (
          <InlineEditInput
            initialValue={collection.name}
            onSave={commitName}
            onCancel={() => setIsEditingName(false)}
            ariaLabel="Collection name"
          />
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
          onAddToCollection={handleAddToCollection}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          collectionId={collectionId}
          onRemoveFromCollection={handleRemoveFromCollection}
        />
      )}

      {addingToCollection ? (
        <AddToCollectionDialog
          verseId={addingToCollection.id}
          verseReference={addingToCollection.reference}
          onClose={handleCloseDialog}
        />
      ) : null}
    </div>
  );
}

