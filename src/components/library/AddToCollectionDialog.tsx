import { useState } from "react";
import { useCollections } from "../../hooks/useCollections";
import { Button } from "../ui/Button";
import { ModalDialog } from "../ui/ModalDialog";

interface AddToCollectionDialogProps {
  verseId: string;
  verseReference: string;
  onClose: () => void;
}

export function AddToCollectionDialog({
  verseId,
  verseReference,
  onClose,
}: AddToCollectionDialogProps) {
  const {
    collections,
    loading,
    createCollection,
    addVerseToCollection,
    removeVerseFromCollection,
    getCollectionsForVerse,
  } = useCollections();
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creating, setCreating] = useState(false);

  const memberOf = new Set(getCollectionsForVerse(verseId).map((c) => c.id));

  async function toggleCollection(collectionId: string, isMember: boolean) {
    if (isMember) {
      await removeVerseFromCollection(collectionId, verseId);
    } else {
      await addVerseToCollection(collectionId, verseId);
    }
  }

  async function handleCreateAndAdd() {
    const name = newCollectionName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const collection = await createCollection(name);
      await addVerseToCollection(collection.id, verseId);
      setNewCollectionName("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <ModalDialog onClose={onClose} cardStyle={{ maxWidth: "26rem", width: "100%" }}>
      <h3 style={{ marginBottom: "0.25rem" }}>Add to Collection</h3>
      <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
        {verseReference}
      </p>

      {loading ? (
        <p style={{ color: "var(--color-ink-muted)" }}>Loading collections…</p>
      ) : collections.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem" }}>
          No collections yet — create one below.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "1rem",
            maxHeight: "12rem",
            overflowY: "auto",
          }}
        >
          {collections.map((collection) => {
            const isMember = memberOf.has(collection.id);
            return (
              <label
                key={collection.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={isMember}
                  onChange={() => toggleCollection(collection.id, isMember)}
                />
                {collection.name}
              </label>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <input
          type="text"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          placeholder="New collection name"
          style={{
            flex: 1,
            padding: "0.5rem 0.65rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            fontFamily: "inherit",
            fontSize: "0.9rem",
          }}
        />
        <Button
          variant="secondary"
          disabled={!newCollectionName.trim() || creating}
          onClick={handleCreateAndAdd}
        >
          Create &amp; Add
        </Button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </ModalDialog>
  );
}

