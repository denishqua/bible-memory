import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useVerses } from "../hooks/useVerses";
import { useCollections } from "../hooks/useCollections";
import { tokenize } from "../lib/tokenize";
import { buildCollectionReviewTokens } from "../lib/collectionReview";
import { ModePicker } from "../components/review/ModePicker";
import { ReviewSession } from "../components/review/ReviewSession";
import { VerseDefenderSession } from "../components/verse-defender/VerseDefenderSession";
import { LaneDefenderSession } from "../components/lane-defender/LaneDefenderSession";
import type { Token } from "../lib/tokenize";
import type { Verse } from "../types/verse";
import { isMaskableReviewMode, type ReviewMode, type ReviewScope } from "../types/review";

// Single dispatch point for "which session component renders this mode" —
// the 3 mask-based modes share ReviewSession/useReviewSession; the 2 arcade
// modes each own their own component. Keeping this here means neither game
// component nor ModePicker need to know about each other.
function renderSession(mode: ReviewMode, scope: ReviewScope, tokens: Token[], onChangeMode: () => void) {
  if (isMaskableReviewMode(mode)) {
    return <ReviewSession scope={scope} tokens={tokens} mode={mode} onChangeMode={onChangeMode} />;
  }
  if (mode === "verse-defender") {
    return <VerseDefenderSession scope={scope} tokens={tokens} onChangeMode={onChangeMode} />;
  }
  return <LaneDefenderSession scope={scope} tokens={tokens} onChangeMode={onChangeMode} />;
}

export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const verseId = searchParams.get("verseId");
  const collectionId = searchParams.get("collectionId");
  const { verses, loading: versesLoading } = useVerses();
  const { collections, loading: collectionsLoading, getVerseIdsForCollection } = useCollections();
  const [mode, setMode] = useState<ReviewMode | null>(null);

  const loading = versesLoading || (collectionId !== null && collectionsLoading);

  const verse = verseId ? verses.find((v) => v.id === verseId) : undefined;
  const collection = collectionId ? collections.find((c) => c.id === collectionId) : undefined;

  // Ordered by date-added (CollectionVerseLink.addedAt) — see
  // useCollections.getVerseIdsForCollection, which now sorts on that field.
  const collectionVerses = useMemo<Verse[]>(() => {
    if (!collectionId) return [];
    const byId = new Map(verses.map((v) => [v.id, v] as const));
    return getVerseIdsForCollection(collectionId)
      .map((id) => byId.get(id))
      .filter((v): v is Verse => v !== undefined);
  }, [collectionId, getVerseIdsForCollection, verses]);

  const { tokens, scope } = useMemo<{ tokens: Token[]; scope: ReviewScope | null }>(() => {
    if (collectionId) {
      if (collectionVerses.length === 0) return { tokens: [], scope: null };
      return {
        tokens: buildCollectionReviewTokens(collectionVerses),
        scope: {
          type: "collection",
          collectionId,
          verseIds: collectionVerses.map((v) => v.id),
        },
      };
    }
    if (verse) {
      return { tokens: tokenize(verse.text), scope: { type: "verse", verseId: verse.id } };
    }
    return { tokens: [], scope: null };
  }, [collectionId, collectionVerses, verse]);

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
          Bulk review — {collectionVerses.length} verse{collectionVerses.length === 1 ? "" : "s"} in
          one continuous session
        </p>
        {mode === null || scope === null ? (
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
      <h1 style={{ marginBottom: "1.25rem" }}>{verse.reference}</h1>
      {mode === null ? (
        <ModePicker onSelect={setMode} />
      ) : (
        renderSession(mode, scope, tokens, () => setMode(null))
      )}
    </div>
  );
}
