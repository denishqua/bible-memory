import { Link } from "react-router-dom";
import type { Verse } from "../../types/verse";
import { Button } from "../ui/Button";
import { VerseActionsMenu } from "./VerseActionsMenu";

// Shared between the header row and verse rows so the columns line up.
// Fixed-ish tracks (no auto/max-content) keep every row's tracks identical.
export const VERSE_GRID_TEMPLATE = "clamp(6.5rem, 24vw, 11rem) minmax(0, 1fr) 3.5rem 7.5rem";

interface VerseRowProps {
  verse: Verse;
  onDelete: (id: string) => void;
  onAddToCollection: (verse: Verse) => void;
}

function preview(text: string): string {
  return text.replace(/\n+/g, " ").trim();
}

export function VerseRow({ verse, onDelete, onAddToCollection }: VerseRowProps) {
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
