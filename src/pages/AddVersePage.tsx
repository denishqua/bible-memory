import { useNavigate } from "react-router-dom";
import { useVerses, type NewVerseInput } from "../hooks/useVerses";
import { AddVerseForm } from "../components/library/AddVerseForm";

export function AddVersePage() {
  const { createVerse } = useVerses();
  const navigate = useNavigate();

  async function handleSubmit(input: NewVerseInput) {
    const verse = await createVerse(input);
    navigate(`/verse/${verse.id}`);
  }

  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem" }}>Add Verse</h1>
      <AddVerseForm onSubmit={handleSubmit} onCancel={() => navigate("/")} />
    </div>
  );
}
