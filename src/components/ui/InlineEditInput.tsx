import { useState, type KeyboardEvent, type CSSProperties } from "react";
import { Button } from "./Button";

interface InlineEditInputProps {
  initialValue: string;
  onSave: (newValue: string) => void | Promise<void>;
  onCancel: () => void;
  ariaLabel?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
}

export function InlineEditInput({
  initialValue,
  onSave,
  onCancel,
  ariaLabel = "Edit field",
  style,
  autoFocus = true,
}: InlineEditInputProps) {
  const [draft, setDraft] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  const handleCommit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSave(draft.trim());
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <input
        type="text"
        value={draft}
        autoFocus={autoFocus}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => void handleCommit()}
        aria-label={ariaLabel}
        disabled={submitting}
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.5rem",
          padding: "0.15rem 0.5rem",
          border: "1px solid var(--color-border)",
          borderRadius: "0.375rem",
          background: "var(--color-surface)",
          color: "var(--color-ink)",
          ...style,
        }}
      />
      <Button
        variant="primary"
        disabled={submitting}
        onMouseDown={(e) => e.preventDefault()} // prevent blur before click handler
        onClick={() => void handleCommit()}
      >
        Save
      </Button>
      <Button
        variant="ghost"
        disabled={submitting}
        onMouseDown={(e) => e.preventDefault()} // prevent blur before click handler
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
