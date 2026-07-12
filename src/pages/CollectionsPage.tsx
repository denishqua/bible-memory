import { useState, type FormEvent } from "react";
import { useCollections } from "../hooks/useCollections";
import { CollectionList } from "../components/collections/CollectionList";
import { Button } from "../components/ui/Button";

export function CollectionsPage() {
  const { collections, loading, createCollection, deleteCollection, getVerseIdsForCollection } =
    useCollections();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createCollection(name);
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem" }}>Collections</h1>

      <form
        onSubmit={handleCreate}
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", maxWidth: "28rem" }}
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New collection name"
          style={{
            flex: 1,
            padding: "0.55rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            fontFamily: "inherit",
            fontSize: "0.95rem",
          }}
        />
        <Button type="submit" variant="primary" disabled={!newName.trim() || creating}>
          Create
        </Button>
      </form>

      {loading ? (
        <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>
      ) : (
        <CollectionList
          collections={collections}
          getVerseCount={(id) => getVerseIdsForCollection(id).length}
          onDelete={deleteCollection}
        />
      )}
    </div>
  );
}
