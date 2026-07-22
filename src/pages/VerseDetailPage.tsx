import { Link, useNavigate, useParams } from "react-router-dom";
import { useVerses } from "../hooks/useVerses";
import type { EditVerseInput } from "../types/verse";
import { EditVerseForm } from "../components/library/EditVerseForm";
import { Card } from "../components/ui/Card";

export function VerseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { verses, loading, updateVerse, deleteVerse } = useVerses();
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
    navigate("/");
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

      <Card>
        <h2 style={{ marginBottom: "1rem" }}>Edit Verse</h2>
        <EditVerseForm
          verse={verse}
          onSubmit={handleSave}
          onCancel={() => navigate("/")}
          onDelete={handleDelete}
        />
      </Card>
    </div>
  );
}
