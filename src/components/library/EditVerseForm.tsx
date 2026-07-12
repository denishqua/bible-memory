import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import type { Verse } from "../../types/verse";
import type { EditVerseInput } from "../../hooks/useVerses";

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
  const [reference, setReference] = useState(verse.reference);
  const [text, setText] = useState(verse.text);
  const [translation, setTranslation] = useState(verse.translation);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = reference.trim().length > 0 && text.trim().length > 0 && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
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
