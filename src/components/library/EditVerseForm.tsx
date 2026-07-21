import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { useCollections } from "../../hooks/useCollections";
import type { EditVerseInput, Verse } from "../../types/verse";

interface EditVerseFormProps {
  verse: Verse;
  onSubmit: (input: EditVerseInput) => void | Promise<void>;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontFamily: "inherit",
  fontSize: "0.95rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.35rem",
  fontSize: "0.85rem",
  color: "var(--color-ink-muted)",
};

export function EditVerseForm({ verse, onSubmit, onCancel }: EditVerseFormProps) {
  const {
    collections,
    loading: collectionsLoading,
    createCollection,
    addVerseToCollection,
    removeVerseFromCollection,
    getCollectionsForVerse,
  } = useCollections();

  const [reference, setReference] = useState(verse.reference);
  const [text, setText] = useState(verse.text);
  const [translation, setTranslation] = useState(verse.translation);
  const [submitting, setSubmitting] = useState(false);

  // Which collections this verse should belong to after saving. Seeded once
  // from the verse's current membership (below), then edited freely; the diff
  // against the stored membership is only persisted at submit time.
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  // Seed the checkboxes from the verse's current membership as soon as the
  // links have loaded (getCollectionsForVerse is empty until then). Guarded so
  // a later refresh — e.g. after creating a collection — never clobbers the
  // user's in-progress selection.
  const seededRef = useRef(false);
  useEffect(() => {
    if (collectionsLoading || seededRef.current) return;
    seededRef.current = true;
    setSelectedCollectionIds(new Set(getCollectionsForVerse(verse.id).map((c) => c.id)));
  }, [collectionsLoading, getCollectionsForVerse, verse.id]);

  const canSubmit = reference.trim().length > 0 && text.trim().length > 0 && !submitting;

  function toggleCollection(id: string) {
    setSelectedCollectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name || creatingCollection) return;
    setCreatingCollection(true);
    try {
      const collection = await createCollection(name);
      setSelectedCollectionIds((prev) => new Set(prev).add(collection.id));
      setNewCollectionName("");
    } finally {
      setCreatingCollection(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Apply the membership diff before onSubmit — onSubmit closes the editor
      // (unmounting this form), so all of this form's own async work must
      // finish first. Diff against the freshly-read stored membership so a
      // collection created mid-edit is treated as an add, not a no-op.
      const current = new Set(getCollectionsForVerse(verse.id).map((c) => c.id));
      const toAdd = [...selectedCollectionIds].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !selectedCollectionIds.has(id));
      for (const id of toAdd) await addVerseToCollection(id, verse.id);
      for (const id of toRemove) await removeVerseFromCollection(id, verse.id);

      await onSubmit({
        reference: reference.trim(),
        text: text.trim(),
        translation: translation.trim() || "ESV",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "32rem" }}
    >
      <div>
        <label style={labelStyle} htmlFor="edit-verse-reference">
          Reference
        </label>
        <input
          id="edit-verse-reference"
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="edit-verse-text">
          Text
        </label>
        <textarea
          id="edit-verse-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          style={{ ...inputStyle, fontFamily: "var(--font-serif)", resize: "vertical" }}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="edit-verse-translation">
          Translation
        </label>
        <input
          id="edit-verse-translation"
          type="text"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          style={{ ...inputStyle, maxWidth: "10rem" }}
        />
      </div>
      <div>
        <label style={labelStyle}>
          Collections <span style={{ opacity: 0.7 }}>(optional)</span>
        </label>
        {collections.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              marginBottom: "0.6rem",
              maxHeight: "10rem",
              overflowY: "auto",
            }}
          >
            {collections.map((collection) => (
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
                  checked={selectedCollectionIds.has(collection.id)}
                  onChange={() => toggleCollection(collection.id)}
                />
                {collection.name}
              </label>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateCollection();
              }
            }}
            placeholder="New collection name"
            style={{ ...inputStyle, flex: 1 }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleCreateCollection}
            disabled={!newCollectionName.trim() || creatingCollection}
          >
            {creatingCollection ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
