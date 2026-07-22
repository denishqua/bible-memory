import { useCallback, useEffect, useState } from "react";
import { useStorage } from "./useStorage";
import type { ReviewSession } from "../types/review";

// Loads the full review-session history. Consumers derive per-verse scores from
// it via src/lib/verseScore.ts. Sessions are append-only, so a plain load +
// manual refresh is enough — no live subscription.
export function useReviewHistory() {
  const storage = useStorage();
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await storage.getReviewSessions();
    setSessions(next);
    setLoading(false);
  }, [storage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, loading, refresh };
}
