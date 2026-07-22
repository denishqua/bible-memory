import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Verse } from "../../types/verse";
import { ModalDialog } from "../ui/ModalDialog";
import { Button } from "../ui/Button";

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
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
    <>
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
              onClick={() => {
                close();
                setShowDeleteModal(true);
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {showDeleteModal && (
        <ModalDialog
          onClose={() => setShowDeleteModal(false)}
          ariaLabel="Delete Verse"
          cardStyle={{
            maxWidth: "26rem",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div>
            <h3 style={{ marginBottom: "0.5rem", fontSize: "1.15rem", fontWeight: 600 }}>Delete Verse</h3>
            <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{verse.reference}</strong>? This action cannot be undone.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onDelete(verse.id);
                setShowDeleteModal(false);
              }}
            >
              Delete
            </Button>
          </div>
        </ModalDialog>
      )}
    </>
  );
}
