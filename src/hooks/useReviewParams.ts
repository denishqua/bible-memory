import { useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

export function useReviewParams() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const verseId = searchParams.get("verseId");
  const collectionId = searchParams.get("collectionId");
  const random = searchParams.get("random") === "1";

  const stateVerseIds = useMemo<string[] | null>(() => {
    const state = location.state as { verseIds?: unknown } | null;
    if (!state || !Array.isArray(state.verseIds)) return null;
    const ids = state.verseIds.filter((id): id is string => typeof id === "string");
    return ids.length > 0 ? ids : null;
  }, [location.state]);

  return { verseId, collectionId, random, stateVerseIds };
}
