import { Card } from "../ui/Card";
import type { PoolSummary } from "../../lib/srs";

// A compact snapshot of the study pool for the top of Study Today: a row of
// stat tiles + a slim stacked distribution bar. Presentational only — it takes
// the already-computed summary (StudyTodayPage passes the one it derived from
// the same pool) so nothing is loaded twice.
//
// Palette: the dataviz method's four categorical slots, snapped to THIS app's
// design tokens rather than an external ramp — new = neutral border (untouched),
// learning = clay (the primary accent), reviewing = ink, mastered = sage ("done").
// Identity is never color-alone: every segment and stat tile is text-labelled
// with its count, and the bar segments carry accessible labels.
interface ProgressDashboardProps {
  summary: PoolSummary;
}

interface Segment {
  key: keyof Pick<PoolSummary, "newCount" | "learningCount" | "reviewingCount" | "masteredCount">;
  label: string;
  color: string;
  count: number;
}

export function ProgressDashboard({ summary }: ProgressDashboardProps) {
  const { total, newCount, learningCount, reviewingCount, masteredCount, dueCount } = summary;

  const segments: Segment[] = [
    { key: "newCount", label: "New", color: "var(--color-border)", count: newCount },
    { key: "learningCount", label: "Learning", color: "var(--color-clay)", count: learningCount },
    { key: "reviewingCount", label: "Reviewing", color: "var(--color-ink-muted)", count: reviewingCount },
    { key: "masteredCount", label: "Mastered", color: "var(--color-sage)", count: masteredCount },
  ];

  const tiles: { label: string; value: number; accent?: boolean }[] = [
    { label: "Total", value: total },
    { label: "Due", value: dueCount, accent: dueCount > 0 },
    { label: "Learning", value: learningCount },
    { label: "Reviewing", value: reviewingCount },
    { label: "Mastered", value: masteredCount },
  ];

  return (
    <Card style={{ marginBottom: "1.25rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>Your progress</h2>

      {/* Stat tiles — wrap on narrow widths. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.1rem" }}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            style={{
              flex: "1 1 5.5rem",
              minWidth: "5rem",
              padding: "0.65rem 0.75rem",
              border: "1px solid var(--color-border)",
              borderRadius: "0.6rem",
              background: "var(--color-bg)",
            }}
          >
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
                color: tile.accent ? "var(--color-clay)" : "var(--color-ink)",
              }}
            >
              {tile.value}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--color-ink-muted)",
                marginTop: "0.15rem",
              }}
            >
              {tile.label}
            </div>
          </div>
        ))}
      </div>

      {/* Distribution bar — proportion of the library by phase. */}
      {total === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "var(--color-ink-muted)" }}>
          No verses in your study pool yet — add verses to see your distribution here.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Library distribution: ${segments
              .map((s) => `${s.count} ${s.label.toLowerCase()}`)
              .join(", ")} of ${total} total`}
            style={{
              display: "flex",
              gap: "2px",
              height: "0.7rem",
              borderRadius: "999px",
              overflow: "hidden",
              background: "var(--color-border)",
            }}
          >
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.key}
                  title={`${s.label}: ${s.count}`}
                  style={{ flexGrow: s.count, background: s.color }}
                />
              ))}
          </div>

          {/* Legend — text + count so identity never rests on color alone. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem 1rem",
              marginTop: "0.7rem",
            }}
          >
            {segments.map((s) => (
              <span
                key={s.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.8rem",
                  color: "var(--color-ink-muted)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "0.65rem",
                    height: "0.65rem",
                    borderRadius: "0.2rem",
                    background: s.color,
                    border: "1px solid var(--color-border)",
                  }}
                />
                {s.label}
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-ink)" }}>
                  {s.count}
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
