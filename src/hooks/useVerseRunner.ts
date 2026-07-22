import { useState } from "react";

// Drives a one-verse-at-a-time review flow (RandomReviewFlow, StudyTodayFlow):
// tracks the current index, whether the run has finished, and whether the
// current verse's reference should be hidden (flipped on once the player is
// ~25% through, so the appended reference can't be read back while it's
// recalled). `advance` moves to the next verse — or finishes on the last — and
// always resets the reference-hidden flag for the fresh verse.
export function useVerseRunner(count: number) {
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [hideReference, setHideReference] = useState(false);

  const isLast = index >= count - 1;

  const advance = () => {
    setHideReference(false);
    if (isLast) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  return { index, isLast, finished, hideReference, setHideReference, advance };
}
