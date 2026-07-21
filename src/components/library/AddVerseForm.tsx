import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "../ui/Button";
import { CollectionSelector } from "./CollectionSelector";
import type { NewVerseInput, Verse } from "../../types/verse";
import { useCollections } from "../../hooks/useCollections";
import { fetchEsvPassage, EsvApiError } from "../../lib/esvApi";
import { cleanEsvText } from "../../lib/verseTextCleanup";
import { useSettings } from "../../hooks/useSettings";

interface AddVerseFormProps {
  // Receives the new verse plus the collection ids it should be added to.
  onSubmit: (input: NewVerseInput, collectionIds: string[]) => void | Promise<void>;
  onCancel?: () => void;
  // Collections to pre-check (e.g. when adding from within a collection).
  initialCollectionIds?: string[];
  // Overrides the submit button's idle label (e.g. "Add to Psalms").
  submitLabel?: string;
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

export function AddVerseForm({
  onSubmit,
  onCancel,
  initialCollectionIds,
  submitLabel,
}: AddVerseFormProps) {
  const { settings } = useSettings();
  const { collections, createCollection } = useCollections();
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("ESV");
  const [source, setSource] = useState<Verse["source"]>("manual");
  const [submitting, setSubmitting] = useState(false);

  // Collections to add this verse to on save. Membership is only persisted at
  // submit time (via onSubmit) — except a newly created collection, which is
  // saved immediately so it can appear in the list and be pre-checked.
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(
    () => new Set(initialCollectionIds ?? []),
  );
  const [creatingCollection, setCreatingCollection] = useState(false);

  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSucceeded, setLookupSucceeded] = useState(false);

  const canSubmit = reference.trim().length > 0 && text.trim().length > 0 && !submitting;
  const canLookUp = reference.trim().length > 0 && !looking;

  function handleReferenceChange(value: string) {
    setReference(value);
    // The reference itself changed, so any prior fetch no longer describes
    // what's in this field — clear its status and fall back to "manual"
    // until a new lookup succeeds. Editing the fetched *text* on its own
    // (fixing an imperfect cleanup) intentionally does NOT do this — that's
    // the safety-valve behavior the plan calls for.
    setLookupSucceeded(false);
    setLookupError(null);
    setSource("manual");
  }

  async function handleLookup() {
    const query = reference.trim();
    if (!query || looking) return;
    setLooking(true);
    setLookupError(null);
    setLookupSucceeded(false);
    try {
      const result = await fetchEsvPassage(query, settings?.esvApiKey);
      setReference(result.reference);
      setText(cleanEsvText(result.rawText));
      setTranslation("ESV");
      setSource("esv-api");
      setLookupSucceeded(true);
    } catch (err) {
      setSource("manual");
      if (err instanceof EsvApiError) {
        setLookupError(err.message);
      } else {
        setLookupError("Something went wrong looking that up — try again or enter the verse manually.");
      }
    } finally {
      setLooking(false);
    }
  }

  function handleReferenceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter in the reference field triggers a lookup instead of submitting
    // the form (which would usually be incomplete at this point anyway).
    if (event.key === "Enter") {
      event.preventDefault();
      handleLookup();
    }
  }

  function toggleCollection(id: string) {
    setSelectedCollectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateCollection(name: string) {
    if (creatingCollection) return;
    setCreatingCollection(true);
    try {
      const collection = await createCollection(name);
      setSelectedCollectionIds((prev) => new Set(prev).add(collection.id));
    } finally {
      setCreatingCollection(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(
        {
          reference: reference.trim(),
          text: text.trim(),
          translation: translation.trim() || "ESV",
          source,
        },
        [...selectedCollectionIds],
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "32rem" }}
    >
      {/* ESV lookup step, ahead of the manual fields below. On success it
          prefills reference/text/translation, which stay fully editable —
          the safety valve for any imperfect cleanup — before saving. If it
          fails for any reason, the fields below remain a fully usable
          manual-entry fallback. */}
      <div>
        <label style={labelStyle} htmlFor="verse-reference">
          Reference
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="verse-reference"
            type="text"
            value={reference}
            onChange={(e) => handleReferenceChange(e.target.value)}
            onKeyDown={handleReferenceKeyDown}
            placeholder="e.g. John 3:16 or Psalm 23:1-3"
            style={{ ...inputStyle, flex: 1 }}
          />
          <Button type="button" variant="secondary" onClick={handleLookup} disabled={!canLookUp}>
            {looking ? "Looking up…" : "Look Up (ESV)"}
          </Button>
        </div>
        {lookupError ? (
          <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginTop: "0.4rem" }}>
            {lookupError} You can still type the reference and text below manually.
          </p>
        ) : null}
        {lookupSucceeded ? (
          <p style={{ color: "var(--color-sage)", fontSize: "0.85rem", marginTop: "0.4rem" }}>
            Fetched from the ESV API — review and edit below before saving.
          </p>
        ) : null}
      </div>
      <div>
        <label style={labelStyle} htmlFor="verse-text">
          Text
        </label>
        <textarea
          id="verse-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type the verse text..."
          rows={6}
          style={{ ...inputStyle, fontFamily: "var(--font-serif)", resize: "vertical" }}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="verse-translation">
          Translation
        </label>
        <input
          id="verse-translation"
          type="text"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="ESV"
          style={{ ...inputStyle, maxWidth: "10rem" }}
        />
      </div>
      <CollectionSelector
        collections={collections}
        selectedCollectionIds={selectedCollectionIds}
        onToggleCollection={toggleCollection}
        onCreateCollection={handleCreateCollection}
        creating={creatingCollection}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
      />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? "Saving…" : (submitLabel ?? "Save Verse")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
