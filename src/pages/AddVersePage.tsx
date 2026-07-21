import { useNavigate, useSearchParams } from "react-router-dom";
import { useVerses } from "../hooks/useVerses";
import type { NewVerseInput } from "../types/verse";
import { useCollections } from "../hooks/useCollections";
import { AddVerseForm } from "../components/library/AddVerseForm";

export function AddVersePage() {
  const { createVerse } = useVerses();
  const { collections, addVerseToCollection } = useCollections();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // When arriving from a collection ("+ Add Verse" there), that collection is
  // pre-selected and we return to it after saving instead of the verse page.
  const collectionId = searchParams.get("collectionId");
  const collection = collectionId ? collections.find((c) => c.id === collectionId) : undefined;

  async function handleSubmit(input: NewVerseInput, collectionIds: string[]) {
    const verse = await createVerse(input);
    for (const id of collectionIds) {
      await addVerseToCollection(id, verse.id);
    }
    navigate(collectionId ? `/collections/${collectionId}` : `/verse/${verse.id}`);
  }

  return (
    <div>
      <h1 style={{ marginBottom: collection ? "0.5rem" : "1.5rem" }}>Add Verse</h1>
      {collection ? (
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.5rem" }}>
          Adding to <strong>{collection.name}</strong>
        </p>
      ) : null}
      <AddVerseForm
        onSubmit={handleSubmit}
        onCancel={() => navigate(collectionId ? `/collections/${collectionId}` : "/")}
        initialCollectionIds={collectionId ? [collectionId] : undefined}
        submitLabel={collection ? `Add to ${collection.name}` : undefined}
      />
    </div>
  );
}
