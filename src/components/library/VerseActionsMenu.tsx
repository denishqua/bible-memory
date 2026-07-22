import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Verse } from "../../types/verse";

interface VerseActionsMenuProps {
  verse: Verse;
  onDelete: (id: string) => void;
  onAddToCollection: (verse: Verse) => void;
  onRemoveFromCollection?: (id: string) => void;
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  background: "transparent",
  border: "none",
  borderRadius: "0.4rem",
  color: "var(--color-ink)",
  fontFamily: "inherit",
  fontSize: "0.9rem",
  cursor: "pointer",
};

export function VerseActionsMenu({
  verse,
  onDelete,
  onAddToCollection,
  onRemoveFromCollection,
}: VerseActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function close() {
    setOpen(false);
    setConfirmingDelete(false);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${verse.reference}`}
        onClick={() => (open ? close() : setOpen(true))}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2rem",
          height: "2rem",
          padding: 0,
          borderRadius: "0.6rem",
          border: "1px solid var(--color-border)",
          background: open ? "var(--color-bg)" : "transparent",
          color: "var(--color-ink)",
          fontSize: "1.1rem",
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ⋯
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={`Actions for ${verse.reference}`}
          style={{
            position: "absolute",
            top: "calc(100% + 0.35rem)",
            right: 0,
            zIndex: 50,
            minWidth: "12rem",
            padding: "0.3rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.6rem",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          {confirmingDelete ? (
            <div style={{ padding: "0.35rem 0.45rem" }}>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-ink-muted)",
                  marginBottom: "0.5rem",
                }}
              >
                Delete {verse.reference}?
              </p>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(verse.id);
                    close();
                  }}
                  style={{
                    ...menuItemStyle,
                    width: "auto",
                    flex: 1,
                    textAlign: "center",
                    color: "var(--color-danger)",
                    border: "1px solid var(--color-danger)",
                    padding: "0.4rem 0.6rem",
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  style={{
                    ...menuItemStyle,
                    width: "auto",
                    flex: 1,
                    textAlign: "center",
                    border: "1px solid var(--color-border)",
                    padding: "0.4rem 0.6rem",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                style={menuItemStyle}
                onClick={() => {
                  close();
                  navigate(`/verse/${verse.id}`);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                style={menuItemStyle}
                onClick={() => {
                  close();
                  onAddToCollection(verse);
                }}
              >
                Add to Collection
              </button>
              {onRemoveFromCollection && (
                <button
                  type="button"
                  role="menuitem"
                  style={{ ...menuItemStyle, color: "var(--color-danger)" }}
                  onClick={() => {
                    close();
                    onRemoveFromCollection(verse.id);
                  }}
                >
                  Remove from Collection
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                style={{ ...menuItemStyle, color: "var(--color-danger)" }}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
