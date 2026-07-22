import { Card } from "../ui/Card";
import type { ReviewMode } from "../../types/review";
import { MODE_OPTIONS } from "../../lib/reviewModes";

interface ModePickerProps {
  onSelect: (mode: ReviewMode) => void;
}

export function ModePicker({ onSelect }: ModePickerProps) {
  return (
    <Card>
      <h2 style={{ marginBottom: "1rem" }}>Choose a review mode</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              textAlign: "left",
              padding: "0.85rem 1rem",
              borderRadius: "0.7rem",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-ink)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <strong style={{ fontSize: "1rem" }}>{option.label}</strong>
            <span style={{ fontSize: "0.85rem", color: "var(--color-ink-muted)" }}>
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
