import { Card } from "../ui/Card";
import type { ReviewMode } from "../../types/review";

interface ModeOption {
  value: ReviewMode;
  label: string;
  description: string;
}

// No auto-progression logic here per the plan — just a simple selector. Which
// mode "should" come next (e.g. by past performance) is a future concern.
const MODE_OPTIONS: ModeOption[] = [
  {
    value: "type-it",
    label: "Type It",
    description: "See the whole verse. Type the first letter of each word to move through it.",
  },
  {
    value: "memorize-it",
    label: "Memorize It",
    description: "Every other word is hidden — recall it before you can type past it.",
  },
  {
    value: "master-it",
    label: "Master It",
    description: "The whole verse is hidden. Recall every word from just its first letter.",
  },
  {
    value: "verse-defender",
    label: "Verse Defender",
    description:
      "Asteroids descend toward your base. Type each word's first letter fast enough to blast it before it lands.",
  },
  {
    value: "lane-defender",
    label: "Lane Defender",
    description:
      "Words fall across four lanes — hit D/F/J/K to fire at the lane holding the correct next word.",
  },
];

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
