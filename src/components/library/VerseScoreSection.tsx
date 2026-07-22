import type { ReviewMode, ReviewSession } from "../../types/review";
import { getDisplayAccuracy } from "../../types/review";

interface VerseScoreSectionProps {
  score: number;
  history: ReviewSession[];
}

const SCORING_MODE_LABELS: Partial<Record<ReviewMode, string>> = {
  "master-it": "Master It",
  "verse-defender": "Verse Defender",
  "lane-defender": "Lane Defender",
};

export function VerseScoreSection({ score, history }: VerseScoreSectionProps) {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--color-border)",
        paddingBottom: "1.25rem",
        marginBottom: "0.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: history.length > 0 ? "1rem" : 0,
        }}
      >
        <div>
          <h4
            style={{
              fontSize: "1rem",
              fontWeight: 500,
              color: "var(--color-ink)",
              marginBottom: "0.15rem",
              fontFamily: "var(--font-serif)",
            }}
          >
            Score
          </h4>
          <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8rem" }}>
            Average of Master It, Verse Defender &amp; Lane Defender reviews
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "2rem",
              color: history.length > 0 ? "var(--color-ink)" : "var(--color-ink-muted)",
            }}
          >
            {score}
          </span>
          <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8rem" }}>
            {history.length > 0
              ? `${history.length} review${history.length === 1 ? "" : "s"}`
              : "No scored reviews yet"}
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            maxHeight: "10rem",
            overflowY: "auto",
            paddingRight: "0.5rem",
          }}
        >
          {history.map((session) => (
            <div
              key={session.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                fontSize: "0.85rem",
                color: "var(--color-ink-muted)",
                borderTop: "1px solid var(--color-border)",
                paddingTop: "0.4rem",
              }}
            >
              <span>{SCORING_MODE_LABELS[session.mode] ?? session.mode}</span>
              <span>{new Date(session.completedAt).toLocaleDateString()}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-ink)" }}>
                {getDisplayAccuracy(session.result)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
