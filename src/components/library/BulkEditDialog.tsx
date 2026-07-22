import { useState, useEffect, useMemo } from "react";
import type { Verse } from "../../types/verse";
import { ModalDialog } from "../ui/ModalDialog";
import { Button } from "../ui/Button";
import { useCollections } from "../../hooks/useCollections";
import { useVerses } from "../../hooks/useVerses";
import { scheduleForBucket, INTERVAL_DAYS, dueLabel } from "../../lib/srs";
import { ReviewScheduleEditor } from "./ReviewScheduleEditor";

interface BulkEditDialogProps {
  selectedVerseIds: string[];
  onClose: () => void;
  verses: Verse[];
}

export function BulkEditDialog({
  selectedVerseIds,
  onClose,
  verses,
}: BulkEditDialogProps) {
  const {
    collections,
    loading: collectionsLoading,
    createCollection,
    addVerseToCollection,
    removeVerseFromCollection,
    getCollectionsForVerse,
  } = useCollections();
  const { setSrsState } = useVerses();

  const [applying, setApplying] = useState(false);
  const [creating, setCreating] = useState(false);

  // Collections selection states
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [dirtyCollections, setDirtyCollections] = useState<Set<string>>(new Set());
  const [hasInitializedCollections, setHasInitializedCollections] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  // Frequency/Countdown state
  const [frequencySelection, setFrequencySelection] = useState<string>("none");
  const [restartCountdown, setRestartCountdown] = useState(false);

  // Initialize selected collections once loaded
  useEffect(() => {
    if (!collectionsLoading && !hasInitializedCollections) {
      const counts = new Map<string, number>();
      for (const id of selectedVerseIds) {
        const memberCols = getCollectionsForVerse(id);
        for (const col of memberCols) {
          counts.set(col.id, (counts.get(col.id) || 0) + 1);
        }
      }

      const initialSelected = new Set<string>();
      for (const [colId, count] of counts.entries()) {
        if (count === selectedVerseIds.length) {
          initialSelected.add(colId);
        }
      }

      setSelectedCollections(initialSelected);
      setHasInitializedCollections(true);
    }
  }, [collectionsLoading, selectedVerseIds, getCollectionsForVerse, hasInitializedCollections]);

  // Handle recently created collection selection
  useEffect(() => {
    if (justCreatedId) {
      setSelectedCollections((prev) => {
        const next = new Set(prev);
        next.add(justCreatedId);
        return next;
      });
      setDirtyCollections((prev) => {
        const next = new Set(prev);
        next.add(justCreatedId);
        return next;
      });
      setJustCreatedId(null);
    }
  }, [justCreatedId]);

  const handleToggleCollection = (colId: string) => {
    const nextSelected = new Set(selectedCollections);
    const nextDirty = new Set(dirtyCollections);

    if (nextSelected.has(colId)) {
      nextSelected.delete(colId);
    } else {
      nextSelected.add(colId);
    }
    nextDirty.add(colId);

    setSelectedCollections(nextSelected);
    setDirtyCollections(nextDirty);
  };

  async function handleCreateCollectionInline() {
    const name = newCollectionName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const col = await createCollection(name);
      setJustCreatedId(col.id);
      setNewCollectionName("");
    } finally {
      setCreating(false);
    }
  }

  // Calculate shared frequency/due labels for display on the right side
  const sharedBucket = useMemo(() => {
    if (selectedVerseIds.length === 0) return undefined;
    const targetVerses = verses.filter((v) => selectedVerseIds.includes(v.id));
    const firstBucket = targetVerses[0]?.srsBucket;
    const allSame = targetVerses.every((v) => v.srsBucket === firstBucket);
    return allSame ? firstBucket : undefined;
  }, [selectedVerseIds, verses]);

  const frequencyText = useMemo(() => {
    if (sharedBucket === undefined) return "Multiple";
    if (sharedBucket === 0) return "Daily";
    return `Every ${INTERVAL_DAYS[sharedBucket]}d`;
  }, [sharedBucket]);

  const dueText = useMemo(() => {
    if (selectedVerseIds.length === 0) return "";
    const targetVerses = verses.filter((v) => selectedVerseIds.includes(v.id));
    const now = new Date();
    const firstDueLabel = dueLabel(targetVerses[0], now);
    const allSame = targetVerses.every((v) => dueLabel(v, now) === firstDueLabel);
    return allSame ? firstDueLabel : "Various schedules";
  }, [selectedVerseIds, verses]);

  async function handleApply() {
    setApplying(true);
    try {
      const now = new Date().toISOString();

      // 1. Handle Collections (Apply dirty changes)
      for (const colId of dirtyCollections) {
        const shouldBeMember = selectedCollections.has(colId);
        if (shouldBeMember) {
          await Promise.all(
            selectedVerseIds.map((id) => addVerseToCollection(colId, id))
          );
        } else {
          await Promise.all(
            selectedVerseIds.map((id) => removeVerseFromCollection(colId, id))
          );
        }
      }

      // 2. Handle Schedule Frequency & Countdown
      if (frequencySelection === "unschedule") {
        await Promise.all(
          selectedVerseIds.map((id) =>
            setSrsState(id, { srsBucket: undefined, dueAt: undefined })
          )
        );
      } else if (frequencySelection !== "none") {
        const bucket = Number(frequencySelection);
        await Promise.all(
          selectedVerseIds.map((id) =>
            setSrsState(id, scheduleForBucket(bucket, now))
          )
        );
      } else if (restartCountdown) {
        // Restart countdown for currently scheduled verses
        const targetVerses = verses.filter(
          (v) => selectedVerseIds.includes(v.id) && v.srsBucket !== undefined
        );
        await Promise.all(
          targetVerses.map((v) =>
            setSrsState(v.id, scheduleForBucket(v.srsBucket!, now))
          )
        );
      }

      onClose();
    } finally {
      setApplying(false);
    }
  }

  return (
    <ModalDialog
      onClose={onClose}
      cardStyle={{
        maxWidth: "34rem",
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        padding: "1.75rem",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div>
        <h3 style={{ marginBottom: "0.25rem", fontSize: "1.35rem" }}>Bulk Edit Verses</h3>
        <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem" }}>
          Apply changes to {selectedVerseIds.length} selected {selectedVerseIds.length === 1 ? "verse" : "verses"}
        </p>
      </div>

      {/* Section 1: Collections Checklist */}
      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
        <h4 style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.6rem", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)" }}>
          Collections (optional)
        </h4>

        {collectionsLoading ? (
          <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>Loading collections…</p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              marginBottom: "0.85rem",
              maxHeight: "10rem",
              overflowY: "auto",
              paddingRight: "0.5rem",
            }}
          >
            {collections.map((c) => {
              const isChecked = selectedCollections.has(c.id);
              return (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    color: "var(--color-ink)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleCollection(c.id)}
                  />
                  {c.name}
                </label>
              );
            })}
            {collections.length === 0 && (
              <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
                No collections yet. Create one below.
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="New collection name"
            style={{
              flex: 1,
              padding: "0.45rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              fontSize: "0.9rem",
              fontFamily: "inherit",
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!newCollectionName.trim() || creating}
            onClick={handleCreateCollectionInline}
            style={{ padding: "0.45rem 1rem", fontSize: "0.85rem" }}
          >
            Create
          </Button>
        </div>
      </div>

      {/* Section 2: Review Schedule */}
      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
        <ReviewScheduleEditor
          frequencyValue={frequencySelection}
          onFrequencyChange={setFrequencySelection}
          restartActive={restartCountdown}
          onRestartToggle={() => setRestartCountdown(!restartCountdown)}
          restartDisabled={frequencySelection === "unscheduled"}
          frequencyText={frequencyText}
          dueText={dueText}
          showNoChangeOption={true}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
        <Button variant="ghost" onClick={onClose} disabled={applying}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleApply}
          disabled={applying}
          style={{ minWidth: "8rem" }}
        >
          {applying ? "Applying…" : "Apply Changes"}
        </Button>
      </div>
    </ModalDialog>
  );
}

