import { Button } from "../ui/Button";
import { SRS_LEVELS } from "../../lib/srs";

interface ReviewScheduleEditorProps {
  frequencyValue: string; // e.g. "none", "unscheduled", or Leitner bucket index ("0".."5")
  onFrequencyChange: (value: string) => void;
  restartActive: boolean;
  onRestartToggle: () => void;
  restartDisabled?: boolean;
  frequencyText: string;
  dueText: string;
  showNoChangeOption?: boolean;
}

export function ReviewScheduleEditor({
  frequencyValue,
  onFrequencyChange,
  restartActive,
  onRestartToggle,
  restartDisabled = false,
  frequencyText,
  dueText,
  showNoChangeOption = false,
}: ReviewScheduleEditorProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "1.5rem",
        width: "100%",
      }}
    >
      <div style={{ flex: 1 }}>
        <h4
          style={{
            fontSize: "1rem",
            fontWeight: 500,
            color: "var(--color-ink)",
            marginBottom: "0.15rem",
            fontFamily: "var(--font-serif)",
          }}
        >
          Review schedule
        </h4>
        <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
          How often this verse resurfaces in Study Today
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-ink-muted)",
            }}
          >
            Frequency
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <select
              value={frequencyValue}
              onChange={(e) => onFrequencyChange(e.target.value)}
              style={{
                padding: "0.4rem 0.6rem",
                fontSize: "0.9rem",
                color: "var(--color-ink)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                fontFamily: "inherit",
              }}
            >
              {showNoChangeOption && <option value="none">-- No change --</option>}
              {frequencyValue === "unscheduled" && !showNoChangeOption && (
                <option value="unscheduled" disabled>
                  New — not scheduled
                </option>
              )}
              {SRS_LEVELS.map((lvl) => (
                <option key={lvl.bucket} value={lvl.bucket}>
                  {lvl.label}
                </option>
              ))}
              <option value="unscheduled">Unscheduled (Remove from rotation)</option>
            </select>

            <Button
              type="button"
              variant={restartActive ? "primary" : "secondary"}
              onClick={onRestartToggle}
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
              disabled={restartDisabled || frequencyValue === "unscheduled"}
            >
              {restartActive ? "✓ Restarting countdown" : "Restart countdown"}
            </Button>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.5rem",
            color: "var(--color-ink)",
          }}
        >
          {frequencyText}
        </span>
        <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8rem" }}>{dueText}</p>
      </div>
    </div>
  );
}
