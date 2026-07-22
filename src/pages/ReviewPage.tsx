import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useVerses } from "../hooks/useVerses";
import { useCollections } from "../hooks/useCollections";
import { useReviewHistory } from "../hooks/useReviewHistory";
import { useReviewParams } from "../hooks/useReviewParams";
import { computeVerseScore } from "../lib/verseScore";
import { buildCollectionReviewTokens } from "../lib/collectionReview";
import { buildVerseReviewTokens } from "../lib/verseReview";
import { ModePicker } from "../components/review/ModePicker";
import { RandomReviewFlow } from "../components/review/RandomReviewFlow";
import { renderSession } from "../components/review/renderSession";
import { useSrsAdvance } from "../hooks/useSrsAdvance";
import type { Token } from "../lib/tokenize";
import type { Verse } from "../types/verse";
import type { ReviewMode, ReviewScope } from "../types/review";

export function ReviewPage() {
  const { verseId, collectionId, random, stateVerseIds } = useReviewParams();
  const { verses, loading: versesLoading } = useVerses();
  const { collections, loading: collectionsLoading, getVerseIdsForCollection } = useCollections();
  const { sessions } = useReviewHistory();
  const { advance: advanceSrs } = useSrsAdvance();
  const [mode, setMode] = useState<ReviewMode | null>(null);
  const [hideReference, setHideReference] = useState(false);

  const loading = versesLoading || (collectionId !== null && collectionsLoading);

  const verse = verseId ? verses.find((v) => v.id === verseId) : undefined;
  const collection = collectionId ? collections.find((c) => c.id === collectionId) : undefined;

  const collectionVerses = useMemo<Verse[]>(() => {
    if (!collectionId) return [];
    const byId = new Map(verses.map((v) => [v.id, v] as const));
    return getVerseIdsForCollection(collectionId)
      .map((id) => byId.get(id))
      .filter((v): v is Verse => v !== undefined);
  }, [collectionId, getVerseIdsForCollection, verses]);

  const selectedVerses = useMemo<Verse[]>(() => {
    if (collectionId) {
      if (!stateVerseIds) return collectionVerses;
      const wanted = new Set(stateVerseIds);
      const subset = collectionVerses.filter((v) => wanted.has(v.id));
      return subset.length > 0 ? subset : collectionVerses;
    } else {
      if (!stateVerseIds) return [];
      const wanted = new Set(stateVerseIds);
      return verses.filter((v) => wanted.has(v.id));
    }
  }, [collectionId, collectionVerses, stateVerseIds, verses]);

  const { tokens, scope } = useMemo<{ tokens: Token[]; scope: ReviewScope | null }>(() => {
    if (collectionId || selectedVerses.length > 0) {
      if (selectedVerses.length === 0) return { tokens: [], scope: null };
      return {
        tokens: buildCollectionReviewTokens(selectedVerses),
        scope: {
          type: "collection",
          collectionId: collectionId ?? "selection",
          verseIds: selectedVerses.map((v) => v.id),
        },
      };
    }
    if (verse) {
      return {
        tokens: buildVerseReviewTokens(verse.text, verse.reference, mode ?? undefined),
        scope: { type: "verse", verseId: verse.id },
      };
    }
    return { tokens: [], scope: null };
  }, [collectionId, selectedVerses, verse, mode]);

  if (loading) {
    return <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>;
  }

  if (collectionId || selectedVerses.length > 0) {
    if (collectionId && !collection) {
      return (
        <div>
          <p style={{ color: "var(--color-ink-muted)" }}>Collection not found.</p>
          <Link to="/collections">Back to Collections</Link>
        </div>
      );
    }

    if (collectionId && collectionVerses.length === 0) {
      return (
        <div>
          <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem" }}>
            "{collection!.name}" has no verses yet. Add some from the Library before starting a
            bulk review.
          </p>
          <Link to={`/collections/${collection!.id}`}>Back to {collection!.name}</Link>
        </div>
      );
    }

    const title = collection ? collection.name : "Selected Verses";
    const backToPath = collection ? `/collections/${collection.id}` : "/";
    const backToLabel = collection ? `Back to ${collection.name}` : "Back to Library";

    return (
      <div>
        <Link
          to={backToPath}
          style={{
            display: "inline-block",
            marginBottom: "1.25rem",
            color: "var(--color-ink-muted)",
            fontSize: "0.9rem",
          }}
        >
          ← {backToLabel}
        </Link>
        <h1 style={{ marginBottom: "0.25rem" }}>{title}</h1>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>
          {random ? (
            <>
              Random review — {selectedVerses.length} verse
              {selectedVerses.length === 1 ? "" : "s"}, one at a time in shuffled order
            </>
          ) : (
            <>
              Bulk review — {selectedVerses.length} verse
              {selectedVerses.length === 1 ? "" : "s"} in one continuous session
            </>
          )}
        </p>
        {random ? (
          <RandomReviewFlow collection={collection ?? undefined} verses={selectedVerses} />
        ) : mode === null || scope === null ? (
          <ModePicker onSelect={setMode} />
        ) : (
          renderSession({
            mode,
            scope,
            tokens,
            onChangeMode: () => setMode(null),
            verseReferences: selectedVerses.map((v) => v.reference),
          })
        )}
      </div>
    );
  }

  if (!verseId || !verse || scope === null) {
    return (
      <div>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem" }}>
          Pick a verse from your Library to start a review session.
        </p>
        <Link to="/">Back to Library</Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to={`/verse/${verse.id}`}
        style={{
          display: "inline-block",
          marginBottom: "1.25rem",
          color: "var(--color-ink-muted)",
          fontSize: "0.9rem",
        }}
      >
        {hideReference || mode === "reference-it" ? "← Back" : `← Back to ${verse.reference}`}
      </Link>
      {!hideReference && mode !== "reference-it" && (
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ marginBottom: "0.15rem" }}>{verse.reference}</h1>
          <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem" }}>
            Score: {computeVerseScore(sessions, verse.id)}
          </p>
        </div>
      )}
      {mode === "reference-it" && (
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ marginBottom: "0.15rem" }}>Reference Review</h1>
          <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem" }}>
            Read the verse below and recall its reference.
          </p>
        </div>
      )}
      {mode === null ? (
        <ModePicker onSelect={setMode} />
      ) : (
        renderSession({
          mode,
          scope,
          tokens,
          onChangeMode: () => setMode(null),
          onComplete: (outcome) => advanceSrs(verse, outcome, mode),
          onHideReference: setHideReference,
        })
      )}
    </div>
  );
}

