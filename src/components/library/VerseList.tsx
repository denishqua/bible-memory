import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Verse } from "../../types/verse";
import type { VerseScore } from "../../lib/verseScore";
import { sortVerses, type SortColumn, type SortDirection } from "../../lib/verseSort";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { VerseRow, VERSE_GRID_TEMPLATE } from "./VerseRow";
import { Tooltip } from "../ui/Tooltip";
import { useCollections } from "../../hooks/useCollections";
import { useVerses } from "../../hooks/useVerses";
import { SRS_LEVELS, scheduleForBucket, INTERVAL_DAYS, dueLabel } from "../../lib/srs";

interface VerseListProps {
  verses: Verse[];
  scores: Map<string, VerseScore>;
  onDelete: (id: string) => void;
  onAddToCollection: (verse: Verse) => void;
  // Selection props for controlled mode:
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  // Context-specific actions:
  collectionId?: string; // If in a collection detail view
  onRemoveFromCollection?: (verseId: string) => void; // Callback to remove from collection
}

const headerCellStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-ink-muted)",
};

// A header rendered as a sort button — same typography as a plain header, but
// clickable and keyboard-focusable, with an arrow showing the active direction.
function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  align = "left",
  tooltip,
}: {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn | null;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right";
  tooltip?: string;
}) {
  const active = activeColumn === column;
  const arrow = active ? (direction === "asc" ? "▲" : "▼") : "";
  const button = (
    <button
      type="button"
      role="columnheader"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      onClick={() => onSort(column)}
      style={{
        ...headerCellStyle,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        flexDirection: align === "right" ? "row-reverse" : "row",
        width: "100%",
        justifyContent: align === "right" ? "flex-start" : "flex-start",
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        font: "inherit",
        letterSpacing: "inherit",
        textTransform: "inherit",
        color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
      }}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{ fontSize: "0.6rem", width: "0.7rem", color: "var(--color-ink-muted)" }}
      >
        {arrow}
      </span>
    </button>
  );

  const wrapped = tooltip ? (
    <Tooltip label={tooltip} placement="top" align={align === "right" ? "end" : "start"}>
      {button}
    </Tooltip>
  ) : (
    button
  );

  return (
    <div
      role="presentation"
      style={{ minWidth: 0, display: "flex", justifyContent: align === "right" ? "flex-end" : "flex-start" }}
    >
      {wrapped}
    </div>
  );
}

function BulkEditDialog({
  selectedVerseIds,
  onClose,
  verses,
}: {
  selectedVerseIds: string[];
  onClose: () => void;
  verses: Verse[];
}) {
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

  // Escape key listener to close popup
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <Card
        style={{
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
        onClick={(e) => e.stopPropagation()}
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

        {/* Section 2: Review Schedule (Reusing VerseDetailPage layout) */}
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "1.5rem",
          }}
        >
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: "1rem", fontWeight: 500, color: "var(--color-ink)", marginBottom: "0.15rem", fontFamily: "var(--font-serif)" }}>
              Review schedule
            </h4>
            <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
              How often this verse resurfaces in Study Today
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-ink-muted)" }}>
                Frequency
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <select
                  value={frequencySelection}
                  onChange={(e) => setFrequencySelection(e.target.value)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.9rem",
                    color: "var(--color-ink)",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.5rem",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="none">-- No change --</option>
                  {SRS_LEVELS.map((lvl) => (
                    <option key={lvl.bucket} value={lvl.bucket}>
                      {lvl.label}
                    </option>
                  ))}
                  <option value="unscheduled">Unscheduled (Remove from rotation)</option>
                </select>
                
                <Button
                  type="button"
                  variant={restartCountdown ? "primary" : "secondary"}
                  onClick={() => setRestartCountdown(!restartCountdown)}
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
                  disabled={frequencySelection === "unscheduled"}
                >
                  {restartCountdown ? "✓ Restarting countdown" : "Restart countdown"}
                </Button>
              </div>
            </div>
          </div>
          
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.5rem",
                color: "var(--color-ink)",
              }}
            >
              {frequencyText}
            </span>
            <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8rem" }}>
              {dueText}
            </p>
          </div>
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
      </Card>
    </div>
  );
}

export function VerseList({
  verses,
  scores,
  onDelete,
  onAddToCollection,
  selectedIds,
  onSelectionChange,
  collectionId,
  onRemoveFromCollection,
}: VerseListProps) {
  const navigate = useNavigate();

  // No sort selected → keep the incoming (storage) order. Clicking a header
  // activates that column; clicking the active one again toggles direction.
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [direction, setDirection] = useState<SortDirection>("asc");

  // Selection states
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set());
  const selected = selectedIds ?? localSelectedIds;
  const setSelected = onSelectionChange ?? setLocalSelectedIds;

  // Dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Sync selection with verses list to prune deleted/removed verses
  useEffect(() => {
    const verseIds = new Set(verses.map((v) => v.id));
    const nextSelected = new Set<string>();
    let changed = false;
    for (const id of selected) {
      if (verseIds.has(id)) {
        nextSelected.add(id);
      } else {
        changed = true;
      }
    }
    if (changed) {
      setSelected(nextSelected);
    }
  }, [verses, selected, setSelected]);

  // Indeterminate checkbox logic
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const allChecked = verses.length > 0 && selected.size === verses.length;
  const anyChecked = selected.size > 0;
  const isIndeterminate = anyChecked && !allChecked;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleToggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(verses.map((v) => v.id)));
    }
  };

  const handleToggleRow = (verseId: string) => {
    const next = new Set(selected);
    if (next.has(verseId)) {
      next.delete(verseId);
    } else {
      next.add(verseId);
    }
    setSelected(next);
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setDirection("asc");
    }
  };

  // Bulk actions handlers
  const handleStartSelectionReview = (randomMode: boolean) => {
    const query = collectionId
      ? randomMode
        ? `/review?collectionId=${collectionId}&random=1`
        : `/review?collectionId=${collectionId}`
      : randomMode
        ? `/review?random=1`
        : `/review`;
    navigate(query, { state: { verseIds: Array.from(selected) } });
  };

  const sortedVerses = useMemo(() => {
    if (sortColumn === null) return verses;
    const scoreOf = (id: string) => scores.get(id)?.score ?? 0;
    return sortVerses(verses, scoreOf, sortColumn, direction);
  }, [verses, scores, sortColumn, direction]);

  if (verses.length === 0) {
    return (
      <Card style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem" }}>
          No verses yet. Add your first verse to start memorizing.
        </p>
        <Link to="/add" style={{ textDecoration: "none" }}>
          <Button variant="primary">+ Add Verse</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card role="table" aria-label="Saved verses" style={{ padding: 0 }}>
      {/* Premium Bulk Actions Toolbar */}
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            borderTopLeftRadius: "inherit",
            borderTopRightRadius: "inherit",
            gap: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-ink)" }}>
              {selected.size} selected
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="secondary"
              onClick={() => handleStartSelectionReview(false)}
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
            >
              Bulk Review
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleStartSelectionReview(true)}
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
            >
              Random Review
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowEditDialog(true)}
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSelected(new Set())}
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div
        role="row"
        style={{
          display: "grid",
          gridTemplateColumns: VERSE_GRID_TEMPLATE,
          gap: "0.75rem",
          alignItems: "center",
          padding: "0.65rem 1rem",
        }}
      >
        <div role="columnheader" style={{ display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={headerCheckboxRef}
            onChange={handleToggleAll}
            aria-label="Select all verses"
          />
        </div>
        <SortableHeader
          label="Reference"
          column="reference"
          activeColumn={sortColumn}
          direction={direction}
          onSort={handleSort}
          tooltip="Sort by where the verse falls in the Bible (Genesis → Revelation)."
        />
        <div role="columnheader" style={headerCellStyle}>
          Verse
        </div>
        <div role="columnheader" style={headerCellStyle}>
          Trans.
        </div>
        <SortableHeader
          label="Score"
          column="score"
          activeColumn={sortColumn}
          direction={direction}
          onSort={handleSort}
          align="right"
          tooltip="Mastery score (0–100): each verse's average accuracy across its Master It, Verse Defender, and Lane Defender reviews. Click to sort."
        />
        <SortableHeader
          label="Review"
          column="review"
          activeColumn={sortColumn}
          direction={direction}
          onSort={handleSort}
          align="right"
          tooltip="Review schedule: when each verse is next due. Click to sort by due time (soonest first); unscheduled verses stay at the bottom."
        />
        <div role="columnheader" style={{ ...headerCellStyle, textAlign: "right" }}>
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clipPath: "inset(50%)",
            }}
          >
            Actions
          </span>
        </div>
      </div>

      {sortedVerses.map((verse) => {
        const verseScore = scores.get(verse.id);
        return (
          <VerseRow
            key={verse.id}
            verse={verse}
            score={verseScore?.score ?? 0}
            reviewCount={verseScore?.count ?? 0}
            onDelete={onDelete}
            onAddToCollection={onAddToCollection}
            isSelected={selected.has(verse.id)}
            onToggleSelect={() => handleToggleRow(verse.id)}
            onRemoveFromCollection={onRemoveFromCollection}
          />
        );
      })}

      {showEditDialog && (
        <BulkEditDialog
          selectedVerseIds={Array.from(selected)}
          onClose={() => {
            setShowEditDialog(false);
            setSelected(new Set());
          }}
          verses={verses}
        />
      )}
    </Card>
  );
}
