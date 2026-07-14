import { useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useVerses } from "../hooks/useVerses";
import { useCollections } from "../hooks/useCollections";
import { useReviewHistory } from "../hooks/useReviewHistory";
import { computeVerseScore } from "../lib/verseScore";
import { tokenize } from "../lib/tokenize";
import { buildCollectionReviewTokens } from "../lib/collectionReview";
import { ModePicker } from "../components/review/ModePicker";
import { RandomReviewFlow } from "../components/review/RandomReviewFlow";
import { renderSession } from "../components/review/renderSession";
import type { Token } from "../lib/tokenize";
import type { Verse } from "../types/verse";
import type { ReviewMode, ReviewScope } from "../types/review";

export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const verseId = searchParams.get("verseId");
  const collectionId = searchParams.get("collectionId");
  const random = searchParams.get("random") === "1";
  const { verses, loading: versesLoading } = useVerses();
  const { collections, loading: collectionsLoading, getVerseIdsForCollection } = useCollections();
  const { sessions } = useReviewHistory();
  const [mode, setMode] = useState<ReviewMode | null>(null);

  // Verse selection handed over by CollectionDetail via router navigation
  // state. Absent on deep links / refreshes — in that case we review ALL
  // verses, exactly like before selection existed.
  const stateVerseIds = useMemo<string[] | null>(() => {
    const state = location.state as { verseIds?: unknown } | null;
    if (!state || !Array.isArray(state.verseIds)) return null;
    const ids = state.verseIds.filter((id): id is string => typeof id === "string");
    return ids.length > 0 ? ids : null;
  }, [location.state]);

  const loading = versesLoading || (collectionId !== null && collectionsLoading);

  const verse = verseId ? verses.find((v) => v.id === verseId) : undefined;
  const collection = collectionId ? collections.find((c) => c.id === collectionId) : undefined;

  // In collection order — explicit sortOrder first, then addedAt; see
  // useCollections.getVerseIdsForCollection.
  const collectionVerses = useMemo<Verse[]>(() => {
    if (!collectionId) return [];
    const byId = new Map(verses.map((v) => [v.id, v] as const));
    return getVerseIdsForCollection(collectionId)
      .map((id) => byId.get(id))
      .filter((v): v is Verse => v !== undefined);
  }, [collectionId, getVerseIdsForCollection, verses]);

  // The verses actually reviewed: the navigation-state selection (kept in
  // collection order, not click order) when present; otherwise all verses.
  // If the selection filters down to nothing (e.g. verses deleted since),
  // fall back to all rather than a dead end.
  const selectedCollectionVerses = useMemo<Verse[]>(() => {
    if (!stateVerseIds) return collectionVerses;
    const wanted = new Set(stateVerseIds);
    const subset = collectionVerses.filter((v) => wanted.has(v.id));
    return subset.length > 0 ? subset : collectionVerses;
  }, [collectionVerses, stateVerseIds]);

  const { tokens, scope } = useMemo<{ tokens: Token[]; scope: ReviewScope | null }>(() => {
    if (collectionId) {
      if (selectedCollectionVerses.length === 0) return { tokens: [], scope: null };
      return {
        tokens: buildCollectionReviewTokens(selectedCollectionVerses),
        scope: {
          type: "collection",
          collectionId,
          verseIds: selectedCollectionVerses.map((v) => v.id),
        },
      };
    }
    if (verse) {
      return { tokens: tokenize(verse.text), scope: { type: "verse", verseId: verse.id } };
    }
    return { tokens: [], scope: null };
  }, [collectionId, selectedCollectionVerses, verse]);

  if (loading) {
    return <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>;
  }

  if (collectionId) {
    if (!collection) {
      return (
        <div>
          <p style={{ color: "var(--color-ink-muted)" }}>Collection not found.</p>
          <Link to="/collections">Back to Collections</Link>
        </div>
      );
    }

    if (collectionVerses.length === 0) {
      return (
        <div>
          <p style={{ color: "var(--color-ink-muted)", marginBottom: "1rem" }}>
            "{collection.name}" has no verses yet. Add some from the Library before starting a
            bulk review.
          </p>
          <Link to={`/collections/${collection.id}`}>Back to {collection.name}</Link>
        </div>
      );
    }

    return (
      <div>
        <Link
          to={`/collections/${collection.id}`}
          style={{
            display: "inline-block",
            marginBottom: "1.25rem",
            color: "var(--color-ink-muted)",
            fontSize: "0.9rem",
          }}
        >
          ← Back to {collection.name}
        </Link>
        <h1 style={{ marginBottom: "0.25rem" }}>{collection.name}</h1>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>
          {random ? (
            <>
              Random review — {selectedCollectionVerses.length} verse
              {selectedCollectionVerses.length === 1 ? "" : "s"}, one at a time in shuffled order
            </>
          ) : (
            <>
              Bulk review — {selectedCollectionVerses.length} verse
              {selectedCollectionVerses.length === 1 ? "" : "s"} in one continuous session
            </>
          )}
        </p>
        {random ? (
          <RandomReviewFlow collection={collection} verses={selectedCollectionVerses} />
        ) : mode === null || scope === null ? (
          <ModePicker onSelect={setMode} />
        ) : (
          renderSession(mode, scope, tokens, () => setMode(null))
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
        ← Back to {verse.reference}
      </Link>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ marginBottom: "0.15rem" }}>{verse.reference}</h1>
        <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem" }}>
          Score: {computeVerseScore(sessions, verse.id)}
        </p>
      </div>
      {mode === null ? (
        <ModePicker onSelect={setMode} />
      ) : (
        renderSession(mode, scope, tokens, () => setMode(null))
      )}
    </div>
  );
}
