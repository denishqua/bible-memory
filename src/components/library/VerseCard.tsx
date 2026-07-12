import { useState } from "react";
import { Link } from "react-router-dom";
import type { Verse } from "../../types/verse";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

interface VerseCardProps {
  verse: Verse;
  onDelete: (id: string) => void;
  onAddToCollection: (verse: Verse) => void;
}

function excerpt(text: string, maxLength = 140): string {
  const flat = text.replace(/\n+/g, " ").trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength).trimEnd()}…` : flat;
}

export function VerseCard({ verse, onDelete, onAddToCollection }: VerseCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <Link
          to={`/verse/${verse.id}`}
          style={{ textDecoration: "none" }}
        >
          <h3 style={{ fontSize: "1.1rem" }}>{verse.reference}</h3>
        </Link>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--color-ink-muted)",
            marginTop: "0.4rem",
          }}
        >
          {excerpt(verse.text)}
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <Link to={`/review?verseId=${verse.id}`} style={{ textDecoration: "none" }}>
          <Button variant="primary">Review</Button>
        </Link>
        <Button variant="ghost" onClick={() => onAddToCollection(verse)}>
          Add to Collection
        </Button>
        <Link to={`/verse/${verse.id}`} style={{ textDecoration: "none" }}>
          <Button variant="ghost">Edit</Button>
        </Link>
        {confirmingDelete ? (
          <>
            <Button
              variant="danger"
              onClick={() => {
                onDelete(verse.id);
                setConfirmingDelete(false);
              }}
            >
              Confirm Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
