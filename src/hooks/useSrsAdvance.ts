import { useCallback, useRef } from "react";
import { useVerses } from "./useVerses";
import { applyReview } from "../lib/srs";
import type { Verse } from "../types/verse";
import type { ReviewMode } from "../types/review";

// Shared "advance a verse's SRS schedule once per verse" handler, factored out of
// the gate/study/review flows so they don't each re-implement it. Returns a
// handler that:
//   - no-ops when there's no outcome or verse (nothing to schedule), or when mode is reference-it,
//   - guards against repeats via a useRef<Set> keyed by verse id, so a Retry that
//     re-fires onComplete for the same verse advances the schedule at most once
//     within a mounted flow,
//   - computes applyReview(verse, accuracy, now) and persists it through
//     useVerses.setSrsState (which broadcasts the update so the due badge and
//     dashboards refresh live).
// A brand-new verse (undefined bucket) lands at bucket 0 on its first review —
// this is how a verse ENTERS the SRS rotation the first time it's reviewed as a
// single verse (Study Today, the verse gate, or a normal single-verse Review).
export function useSrsAdvance() {
  const { setSrsState } = useVerses();

  // Verse ids already advanced within this mounted flow.
  const processedRef = useRef<Set<string>>(new Set());

  const advance = useCallback(
    (
      verse: Verse | null | undefined,
      outcome?: { accuracy: number; passed: boolean },
      mode?: ReviewMode,
    ) => {
      if (!outcome || !verse) return;
      if (mode === "reference-it") return;
      if (processedRef.current.has(verse.id)) return;
      processedRef.current.add(verse.id);
      // `passed` drives only the recorded ReviewResult / summary UI (owned by the
      // session component). The SRS decision uses the raw accuracy: a pass
      // (>= 90%) advances one bucket, a fail leaves the schedule unchanged.
      const srs = applyReview(verse, outcome.accuracy, new Date().toISOString());
      void setSrsState(verse.id, srs);
    },
    [setSrsState],
  );

  return { advance };
}
