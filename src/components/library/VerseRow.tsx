import { Link } from "react-router-dom";
import type { Verse } from "../../types/verse";
import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
import { ReviewScheduleBadge } from "../ui/ReviewScheduleBadge";
import { VerseActionsMenu } from "./VerseActionsMenu";

// Shared between the header row and verse rows so the columns line up.
// Fixed-ish tracks (no auto/max-content) keep every row's tracks identical.
// Columns: Reference · Verse · Trans. · Score · Review · Actions.
export const VERSE_GRID_TEMPLATE =
  "clamp(6.5rem, 22vw, 11rem) minmax(0, 1fr) 3.5rem 3.25rem 6.25rem 7.5rem";

interface VerseRowProps {
  verse: Verse;
  score: number; // 0–100 mastery score (0 when never reviewed in a scoring mode)
  reviewCount: number; // contributing sessions, for the tooltip
  onDelete: (id: string) => void;
  onAddToCollection: (verse: Verse) => void;
}

function preview(text: string): string {
  return text.replace(/\n+/g, " ").trim();
}

export function VerseRow({ verse, score, reviewCount, onDelete, onAddToCollection }: VerseRowProps) {
  return (
    <div
      role="row"
      style={{
        display: "grid",
        gridTemplateColumns: VERSE_GRID_TEMPLATE,
        gap: "0.75rem",
        alignItems: "center",
        padding: "0.6rem 1rem",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div role="cell" style={{ minWidth: 0 }}>
        <Link
          to={`/verse/${verse.id}`}
          style={{
            display: "block",
            fontWeight: 600,
            fontSize: "0.95rem",
            color: "var(--color-ink)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={verse.reference}
        >
          {verse.reference}
        </Link>
      </div>

      <div
        role="cell"
        style={{
          minWidth: 0,
          fontFamily: "var(--font-serif)",
          fontSize: "0.95rem",
          color: "var(--color-ink-muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={preview(verse.text)}
      >
        {preview(verse.text)}
      </div>

      <div role="cell" style={{ minWidth: 0 }}>
        <span
          style={{
            display: "inline-block",
            maxWidth: "100%",
            padding: "0.1rem 0.5rem",
            borderRadius: "999px",
            border: "1px solid var(--color-border)",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--color-ink-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            verticalAlign: "middle",
          }}
          title={verse.translation}
        >
          {verse.translation}
        </span>
      </div>

      <div
        role="cell"
        style={{
          minWidth: 0,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.9rem",
          fontWeight: 600,
          color: reviewCount > 0 ? "var(--color-ink)" : "var(--color-ink-muted)",
        }}
      >
        <Tooltip
          label={
            reviewCount > 0
              ? `Mastery score (0–100): your average accuracy across ${reviewCount} recall review${reviewCount === 1 ? "" : "s"} of this verse — Master It, Verse Defender, and Lane Defender.`
              : "Mastery score (0–100): your average recall accuracy for this verse. Review it in Master It, Verse Defender, or Lane Defender to build a score."
          }
          placement="top"
          align="end"
          focusable={false}
        >
          {score}
        </Tooltip>
      </div>

      <div
        role="cell"
        style={{ minWidth: 0, display: "flex", justifyContent: "flex-end" }}
      >
        <ReviewScheduleBadge verse={verse} />
      </div>

      <div
        role="cell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "0.5rem",
        }}
      >
        <Link to={`/review?verseId=${verse.id}`} style={{ textDecoration: "none" }}>
          <Button variant="primary" style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}>
            Review
          </Button>
        </Link>
        <VerseActionsMenu
          verse={verse}
          onDelete={onDelete}
          onAddToCollection={onAddToCollection}
        />
      </div>
    </div>
  );
}
