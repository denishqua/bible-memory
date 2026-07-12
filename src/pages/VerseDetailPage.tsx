import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useVerses, type EditVerseInput } from "../hooks/useVerses";
import { EditVerseForm } from "../components/library/EditVerseForm";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function VerseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { verses, loading, updateVerse, deleteVerse } = useVerses();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const navigate = useNavigate();

  const verse = verses.find((v) => v.id === id);

  if (loading) {
    return <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>;
  }

  if (!verse) {
    return (
      <div>
        <p style={{ color: "var(--color-ink-muted)" }}>Verse not found.</p>
        <Link to="/">Back to Library</Link>
      </div>
    );
  }

  async function handleSave(input: EditVerseInput) {
    await updateVerse(verse!.id, input);
    setIsEditing(false);
  }

  async function handleDelete() {
    await deleteVerse(verse!.id);
    navigate("/");
  }

  return (
    <div>
      <Link
        to="/"
        style={{
          display: "inline-block",
          marginBottom: "1.25rem",
          color: "var(--color-ink-muted)",
          fontSize: "0.9rem",
        }}
      >
        ← Back to Library
      </Link>

      {isEditing ? (
        <Card>
          <h2 style={{ marginBottom: "1rem" }}>Edit Verse</h2>
          <EditVerseForm verse={verse} onSubmit={handleSave} onCancel={() => setIsEditing(false)} />
        </Card>
      ) : (
        <Card>
          <h1 style={{ marginBottom: "0.75rem" }}>{verse.reference}</h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.15rem",
              lineHeight: 1.6,
              whiteSpace: "pre-line",
              marginBottom: "0.5rem",
            }}
          >
            {verse.text}
          </p>
          <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            {verse.translation}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <Link to={`/review?verseId=${verse.id}`} style={{ textDecoration: "none" }}>
              <Button variant="primary">Review</Button>
            </Link>
            <Button variant="ghost" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            {confirmingDelete ? (
              <>
                <Button variant="danger" onClick={handleDelete}>
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
      )}
    </div>
  );
}
