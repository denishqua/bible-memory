import { useEffect } from "react";
import { shouldHideReference } from "../lib/verseReview";

// The three session components all fold the reference into their token stream
// and, once the player is ~25% through the VERSE words, notify the host so it
// can hide the reference shown in its own chrome (page heading / gate). This
// encapsulates that shared derive-and-notify: derive `hideReference` from the
// per-session cleared-word count vs the verse's matchable-word count, fire
// `onHideReference` when it changes, and reset the host to "shown" on unmount.
//
// `clearedCount` differs per session (Master It = completed words, Verse
// Defender = destroyed count, Lane Defender = its own progress) and is passed
// in rather than computed here.
export function useHideReference(
  clearedCount: number,
  verseMatchableCount: number,
  hasReference: boolean,
  onHideReference?: (hidden: boolean) => void,
): void {
  const hideReference = hasReference && shouldHideReference(verseMatchableCount, clearedCount);

  useEffect(() => {
    onHideReference?.(hideReference);
    return () => onHideReference?.(false);
  }, [hideReference, onHideReference]);
}
