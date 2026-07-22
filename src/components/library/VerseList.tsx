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
import { SRS_LEVELS, scheduleForBucket } from "../../lib/srs";

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

// Styling tokens for modern, iOS-like segmented controls
const segmentedControlStyle: React.CSSProperties = {
  display: "flex",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.6rem",
  padding: "0.2rem",
  gap: "0.2rem",
  marginBottom: "0.75rem",
  width: "100%",
};

const getSegmentBtnStyle = (isActive: boolean, isDanger = false): React.CSSProperties => ({
  flex: 1,
  background: isActive ? "var(--color-surface)" : "transparent",
  border: "none",
  borderRadius: "0.45rem",
  padding: "0.55rem 0.5rem",
  fontSize: "0.85rem",
  fontWeight: isActive ? 600 : 500,
  color: isActive
    ? isDanger ? "var(--color-danger)" : "var(--color-ink)"
    : "var(--color-ink-muted)",
  cursor: "pointer",
  boxShadow: isActive ? "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)" : "none",
  transition: "all 0.15s ease",
  textAlign: "center",
  fontFamily: "inherit",
});

function BulkEditDialog({
  selectedVerseIds,
  onClose,
  collectionId,
  onRemoveFromCollection,
  verses,
}: {
  selectedVerseIds: string[];
  onClose: () => void;
  collectionId?: string;
  onRemoveFromCollection?: (id: string) => void;
  verses: Verse[];
}) {
  const {
    collections,
    loading: collectionsLoading,
    createCollection,
    addVerseToCollection,
    removeVerseFromCollection,
  } = useCollections();
  const { setSrsState } = useVerses();

  const [applying, setApplying] = useState(false);

  // Collections state
  const [collectionAction, setCollectionAction] = useState<"none" | "add" | "remove" | "remove-current">("none");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");

  // Frequency/Countdown state
  const [frequencyAction, setFrequencyAction] = useState<"none" | "change" | "unschedule">("none");
  const [targetBucket, setTargetBucket] = useState("0");
  const [restartCountdown, setRestartCountdown] = useState(false);

  useEffect(() => {
    if (collections.length > 0) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const hasRemoveCurrentOption = Boolean(collectionId && onRemoveFromCollection);

  async function handleApply() {
    setApplying(true);
    try {
      const now = new Date().toISOString();

      // 1. Handle Collections
      let colId = selectedCollectionId;
      if (collectionAction === "add" && newCollectionName.trim()) {
        const newCol = await createCollection(newCollectionName.trim());
        colId = newCol.id;
      }

      if (collectionAction === "add" && colId) {
        await Promise.all(
          selectedVerseIds.map((id) => addVerseToCollection(colId, id))
        );
      } else if (collectionAction === "remove" && colId) {
        await Promise.all(
          selectedVerseIds.map((id) => removeVerseFromCollection(colId, id))
        );
      } else if (collectionAction === "remove-current" && onRemoveFromCollection) {
        await Promise.all(
          selectedVerseIds.map((id) => onRemoveFromCollection(id))
        );
      }

      // 2. Handle Schedule Frequency & Countdown
      if (frequencyAction === "unschedule") {
        await Promise.all(
          selectedVerseIds.map((id) =>
            setSrsState(id, { srsBucket: undefined, dueAt: undefined })
          )
        );
      } else if (frequencyAction === "change") {
        const bucket = Number(targetBucket);
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

        {/* Section 1: Collections */}
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
          <h4 style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.6rem", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)" }}>
            Collections
          </h4>
          
          <div style={segmentedControlStyle}>
            <button
              type="button"
              onClick={() => setCollectionAction("none")}
              style={getSegmentBtnStyle(collectionAction === "none")}
            >
              No change
            </button>
            <button
              type="button"
              onClick={() => setCollectionAction("add")}
              style={getSegmentBtnStyle(collectionAction === "add")}
            >
              Add
            </button>
            {!collectionsLoading && collections.length > 0 && (
              <button
                type="button"
                onClick={() => setCollectionAction("remove")}
                style={getSegmentBtnStyle(collectionAction === "remove")}
              >
                Remove
              </button>
            )}
            {hasRemoveCurrentOption && (
              <button
                type="button"
                onClick={() => setCollectionAction("remove-current")}
                style={getSegmentBtnStyle(collectionAction === "remove-current", true)}
              >
                Remove Current
              </button>
            )}
          </div>

          {collectionAction === "add" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
              {collectionsLoading ? (
                <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>Loading collections…</p>
              ) : collections.length > 0 ? (
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-ink)",
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                  }}
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Or type a new collection name"
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                }}
              />
            </div>
          )}

          {collectionAction === "remove" && collections.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                }}
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section 2: Review Schedule */}
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
          <h4 style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.6rem", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)" }}>
            Review Schedule
          </h4>

          <div style={segmentedControlStyle}>
            <button
              type="button"
              onClick={() => setFrequencyAction("none")}
              style={getSegmentBtnStyle(frequencyAction === "none")}
            >
              No change
            </button>
            <button
              type="button"
              onClick={() => setFrequencyAction("change")}
              style={getSegmentBtnStyle(frequencyAction === "change")}
            >
              Set Frequency
            </button>
            <button
              type="button"
              onClick={() => setFrequencyAction("unschedule")}
              style={getSegmentBtnStyle(frequencyAction === "unschedule")}
            >
              Unschedule
            </button>
          </div>

          {frequencyAction === "change" && (
            <div style={{ marginTop: "0.5rem" }}>
              <select
                value={targetBucket}
                onChange={(e) => setTargetBucket(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                }}
              >
                {SRS_LEVELS.map((lvl) => (
                  <option key={lvl.bucket} value={lvl.bucket}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section 3: Countdown Restart */}
        {frequencyAction === "none" && (
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
            <h4 style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.6rem", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-muted)" }}>
              Countdown
            </h4>
            
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.6rem",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
              }}
              onClick={() => setRestartCountdown(!restartCountdown)}
            >
              <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--color-ink)" }}>
                Restart countdown timer for scheduled verses
              </span>
              <input
                type="checkbox"
                checked={restartCountdown}
                onChange={(e) => setRestartCountdown(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "1.15rem",
                  height: "1.15rem",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>
        )}

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
          collectionId={collectionId}
          onRemoveFromCollection={onRemoveFromCollection}
          verses={verses}
        />
      )}
    </Card>
  );
}
