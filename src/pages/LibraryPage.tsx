import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useVerses } from "../hooks/useVerses";
import { useReviewHistory } from "../hooks/useReviewHistory";
import { computeVerseScores } from "../lib/verseScore";
import { VerseList } from "../components/library/VerseList";
import { AddToCollectionDialog } from "../components/library/AddToCollectionDialog";
import { Button } from "../components/ui/Button";
import type { Verse } from "../types/verse";

export function LibraryPage() {
  const { verses, loading, deleteVerse } = useVerses();
  const { sessions } = useReviewHistory();
  const scores = useMemo(() => computeVerseScores(sessions), [sessions]);
  const [addingToCollection, setAddingToCollection] = useState<Verse | null>(null);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <h1>Library</h1>
        <Link to="/add" style={{ textDecoration: "none" }}>
          <Button variant="primary">+ Add Verse</Button>
        </Link>
      </div>

      {loading ? (
        <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>
      ) : (
        <VerseList
          verses={verses}
          scores={scores}
          onDelete={deleteVerse}
          onAddToCollection={(verse) => setAddingToCollection(verse)}
        />
      )}

      {addingToCollection ? (
        <AddToCollectionDialog
          verseId={addingToCollection.id}
          verseReference={addingToCollection.reference}
          onClose={() => setAddingToCollection(null)}
        />
      ) : null}
    </div>
  );
}
