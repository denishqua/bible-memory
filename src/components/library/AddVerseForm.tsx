import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "../ui/Button";
import { VerseEditorFields } from "./VerseEditorFields";
import type { NewVerseInput, Verse } from "../../types/verse";
import { useCollections } from "../../hooks/useCollections";
import { useCollectionSelection } from "../../hooks/useCollectionSelection";
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

  // Collections to add this verse to on save
  const { selectedIds, toggle, createAndSelect, creating } = useCollectionSelection(
    createCollection,
    initialCollectionIds
  );

  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSucceeded, setLookupSucceeded] = useState(false);

  const canSubmit = reference.trim().length > 0 && text.trim().length > 0 && !submitting;
  const canLookUp = reference.trim().length > 0 && !looking;

  function handleReferenceChange(value: string) {
    setReference(value);
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
    if (event.key === "Enter") {
      event.preventDefault();
      handleLookup();
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
          source
        },
        [...selectedIds]
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
      <VerseEditorFields
        reference={reference}
        onChangeReference={handleReferenceChange}
        text={text}
        onChangeText={setText}
        translation={translation}
        onChangeTranslation={setTranslation}
        showLookup={true}
        onLookup={handleLookup}
        looking={looking}
        canLookUp={canLookUp}
        lookupError={lookupError}
        lookupSucceeded={lookupSucceeded}
        onReferenceKeyDown={handleReferenceKeyDown}
        collections={collections}
        selectedCollectionIds={selectedIds}
        onToggleCollection={toggle}
        onCreateCollection={createAndSelect}
        creating={creating}
      />

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? "Saving…" : (submitLabel ?? "Add Verse")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
