import { Button } from "../ui/Button";
import { inputStyle, labelStyle } from "../ui/formStyles";
import { CollectionSelector } from "./CollectionSelector";
import type { Collection } from "../../types/collection";

interface VerseEditorFieldsProps {
  reference: string;
  onChangeReference: (val: string) => void;
  text: string;
  onChangeText: (val: string) => void;
  translation: string;
  onChangeTranslation: (val: string) => void;

  // ESV Lookup (optional)
  showLookup?: boolean;
  onLookup?: () => void;
  looking?: boolean;
  canLookUp?: boolean;
  lookupError?: string | null;
  lookupSucceeded?: boolean;
  onReferenceKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;

  // Collections Selector
  collections: Collection[];
  selectedCollectionIds: Set<string>;
  onToggleCollection: (id: string) => void;
  onCreateCollection: (name: string) => Promise<string | void>;
  creating: boolean;
}

export function VerseEditorFields({
  reference,
  onChangeReference,
  text,
  onChangeText,
  translation,
  onChangeTranslation,
  showLookup = false,
  onLookup,
  looking = false,
  canLookUp = false,
  lookupError = null,
  lookupSucceeded = false,
  onReferenceKeyDown,
  collections,
  selectedCollectionIds,
  onToggleCollection,
  onCreateCollection,
  creating,
}: VerseEditorFieldsProps) {
  return (
    <>
      <div>
        <label style={labelStyle} htmlFor="verse-reference">
          Reference
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="verse-reference"
            type="text"
            value={reference}
            onChange={(e) => onChangeReference(e.target.value)}
            onKeyDown={onReferenceKeyDown}
            placeholder="e.g. John 3:16 or Psalm 23:1-3"
            style={{ ...inputStyle, flex: 1 }}
          />
          {showLookup && onLookup && (
            <Button
              type="button"
              variant="secondary"
              onClick={onLookup}
              disabled={!canLookUp || looking}
            >
              {looking ? "Looking up…" : "Look Up (ESV)"}
            </Button>
          )}
        </div>
        {showLookup && lookupError && (
          <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginTop: "0.4rem" }}>
            {lookupError} You can still type the reference and text below manually.
          </p>
        )}
        {showLookup && lookupSucceeded && (
          <p style={{ color: "var(--color-sage)", fontSize: "0.85rem", marginTop: "0.4rem" }}>
            Fetched from the ESV API — review and edit below before saving.
          </p>
        )}
      </div>

      <div>
        <label style={labelStyle} htmlFor="verse-text">
          Text
        </label>
        <textarea
          id="verse-text"
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
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
          onChange={(e) => onChangeTranslation(e.target.value)}
          style={{ ...inputStyle, maxWidth: "10rem" }}
        />
      </div>

      <CollectionSelector
        collections={collections}
        selectedCollectionIds={selectedCollectionIds}
        onToggleCollection={onToggleCollection}
        onCreateCollection={onCreateCollection}
        creating={creating}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
      />
    </>
  );
}
