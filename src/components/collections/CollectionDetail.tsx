import { useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCollections } from "../../hooks/useCollections";
import { useVerses } from "../../hooks/useVerses";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
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
    reorderCollectionVerses,
  } = useCollections();
  const { verses, loading: versesLoading } = useVerses();
  const navigate = useNavigate();

  // Selection is tracked as the set of DESELECTED ids so the default is
  // "everything selected" — including verses added while this page is open.
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());

  // Drag-to-reorder state (HTML5 drag and drop, mouse-first — touch devices
  // don't fire these events; a touch fallback can be layered on later).
  // `armedIndex`: row whose drag HANDLE got mousedown — only that row is
  // draggable, so text selection / checkbox clicks never start a drag.
  // `dropIndex`: insertion position 0..length while a drag is in flight.
  const [armedIndex, setArmedIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const collection = collections.find((c) => c.id === collectionId);

  // In collection order (explicit sortOrder first, then addedAt) — the same
  // order bulk review plays through.
  const orderedVerseIds = getVerseIdsForCollection(collectionId);
  const versesById = new Map(verses.map((v) => [v.id, v] as const));
  const collectionVerses = orderedVerseIds
    .map((id) => versesById.get(id))
    .filter((v): v is Verse => v !== undefined);

  const selectedVerseIds = collectionVerses
    .map((v) => v.id)
    .filter((id) => !deselectedIds.has(id));
  const allSelected = collectionVerses.length > 0 && selectedVerseIds.length === collectionVerses.length;
  const noneSelected = selectedVerseIds.length === 0;

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

  const toggleVerseSelected = (verseId: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(verseId)) {
        next.delete(verseId);
      } else {
        next.add(verseId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setDeselectedIds(new Set(collectionVerses.map((v) => v.id)));
    } else {
      setDeselectedIds(new Set());
    }
  };

  const resetDrag = () => {
    setArmedIndex(null);
    setDragIndex(null);
    setDropIndex(null);
  };

  // True when dropping at `dropIndex` would leave the order unchanged.
  const isNoopDrop =
    dragIndex === null ||
    dropIndex === null ||
    dropIndex === dragIndex ||
    dropIndex === dragIndex + 1;

  const handleRowDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    // Only drags initiated from the handle are allowed through.
    if (armedIndex !== index) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", collectionVerses[index].id);
    setDragIndex(index);
  };

  const handleRowDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    // Above the row's midpoint → insert before it; below → insert after.
    const rect = event.currentTarget.getBoundingClientRect();
    const insertion = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
    setDropIndex((prev) => (prev === insertion ? prev : insertion));
  };

  // Persist the FULL resulting order — every link gets an explicit sortOrder,
  // so the order survives regardless of the original addedAt values.
  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const from = dragIndex;
    const to = dropIndex;
    resetDrag();
    if (from === null || to === null || to === from || to === from + 1) return;
    const nextOrder = collectionVerses.map((v) => v.id);
    const [moved] = nextOrder.splice(from, 1);
    nextOrder.splice(to > from ? to - 1 : to, 0, moved);
    await reorderCollectionVerses(collectionId, nextOrder);
  };

  const startReview = (randomMode: boolean) => {
    if (noneSelected) return;
    const query = randomMode
      ? `/review?collectionId=${collectionId}&random=1`
      : `/review?collectionId=${collectionId}`;
    // Selection rides along as router state; ReviewPage falls back to ALL
    // verses when it's absent (deep link / refresh).
    navigate(query, { state: { verseIds: selectedVerseIds } });
  };

  const reviewDisabled = collectionVerses.length === 0 || noneSelected;
  const reviewDisabledHint =
    collectionVerses.length === 0
      ? "Add a verse to this collection first"
      : noneSelected
        ? "Select at least one verse to review"
        : undefined;

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
        <h2>{collection.name}</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            disabled={reviewDisabled}
            title={reviewDisabledHint}
            onClick={() => startReview(true)}
          >
            Random Review
          </Button>
          <Button
            variant="primary"
            disabled={reviewDisabled}
            title={reviewDisabledHint}
            onClick={() => startReview(false)}
          >
            Bulk Review
          </Button>
        </div>
      </div>

      {collectionVerses.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted)" }}>
          No verses in this collection yet. Add verses from the Library using "Add to
          Collection."
        </p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          // Container-level handlers so drops landing in the gaps between
          // rows still commit (row handlers bubble up here too).
          onDragOver={(event) => {
            if (dragIndex === null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={handleDrop}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--color-ink-muted)",
              fontSize: "0.9rem",
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            Select all ({selectedVerseIds.length} of {collectionVerses.length} selected)
          </label>

          {collectionVerses.map((verse, index) => (
            <Card
              key={verse.id}
              draggable={armedIndex === index}
              onDragStart={(event) => handleRowDragStart(event, index)}
              onDragOver={(event) => handleRowDragOver(event, index)}
              onDragEnd={resetDrag}
              // If the handle was pressed but no drag started, disarm so the
              // row doesn't stay draggable from arbitrary spots.
              onMouseUp={() => setArmedIndex(null)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
                // Dragged row dims; the insertion point is drawn as a 2px
                // clay line just outside the row it would land before (or
                // after the last row) — box-shadow so the layout never jumps.
                opacity: dragIndex === index ? 0.4 : 1,
                boxShadow: !isNoopDrop
                  ? dropIndex === index
                    ? "0 -5px 0 -3px var(--color-clay), var(--shadow-soft)"
                    : dropIndex === collectionVerses.length && index === collectionVerses.length - 1
                      ? "0 5px 0 -3px var(--color-clay), var(--shadow-soft)"
                      : undefined
                  : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span
                  onMouseDown={() => setArmedIndex(index)}
                  title={`Drag to reorder ${verse.reference}`}
                  aria-hidden="true"
                  style={{
                    color: "var(--color-ink-muted)",
                    cursor: dragIndex !== null ? "grabbing" : "grab",
                    userSelect: "none",
                    padding: "0.25rem 0.25rem",
                    fontSize: "0.9rem",
                    lineHeight: 1,
                  }}
                >
                  ⠿
                </span>
                <input
                  type="checkbox"
                  checked={!deselectedIds.has(verse.id)}
                  onChange={() => toggleVerseSelected(verse.id)}
                  aria-label={`Include ${verse.reference} in review`}
                />
                <Link to={`/verse/${verse.id}`} style={{ textDecoration: "none" }}>
                  <h3 style={{ fontSize: "1rem" }}>{verse.reference}</h3>
                </Link>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link to={`/review?verseId=${verse.id}`} style={{ textDecoration: "none" }}>
                  <Button variant="ghost">Review</Button>
                </Link>
                <Button
                  variant="danger"
                  onClick={() => removeVerseFromCollection(collectionId, verse.id)}
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
