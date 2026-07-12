import { Link } from "react-router-dom";
import { useCollections } from "../../hooks/useCollections";
import { useVerses } from "../../hooks/useVerses";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface CollectionDetailProps {
  collectionId: string;
}

export function CollectionDetail({ collectionId }: CollectionDetailProps) {
  const { collections, loading: collectionsLoading, getVerseIdsForCollection, removeVerseFromCollection } =
    useCollections();
  const { verses, loading: versesLoading } = useVerses();

  const collection = collections.find((c) => c.id === collectionId);
  const verseIds = new Set(getVerseIdsForCollection(collectionId));
  const collectionVerses = verses.filter((v) => verseIds.has(v.id));

  if (collectionsLoading || versesLoading) {
    return <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>;
  }

  if (!collection) {
    return (
      <div>
        <p style={{ color: "var(--color-ink-muted)" }}>Collection not found.</p>
        <Link to="/collections">Back to Collections</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h2>{collection.name}</h2>
        {collectionVerses.length === 0 ? (
          <Button variant="primary" disabled title="Add a verse to this collection first">
            Bulk Review
          </Button>
        ) : (
          <Link to={`/review?collectionId=${collectionId}`} style={{ textDecoration: "none" }}>
            <Button variant="primary">Bulk Review</Button>
          </Link>
        )}
      </div>

      {collectionVerses.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted)" }}>
          No verses in this collection yet. Add verses from the Library using "Add to
          Collection."
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {collectionVerses.map((verse) => (
            <Card
              key={verse.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <Link to={`/verse/${verse.id}`} style={{ textDecoration: "none" }}>
                <h3 style={{ fontSize: "1rem" }}>{verse.reference}</h3>
              </Link>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link to={`/review?verseId=${verse.id}`} style={{ textDecoration: "none" }}>
                  <Button variant="ghost">Review</Button>
                </Link>
                <Button
                  variant="danger"
                  onClick={() => removeVerseFromCollection(collectionId, verse.id)}
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
