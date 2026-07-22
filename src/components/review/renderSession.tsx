import { ReviewSession } from "./ReviewSession";
import { VerseDefenderSession } from "../verse-defender/VerseDefenderSession";
import { LaneDefenderSession } from "../lane-defender/LaneDefenderSession";
import type { Token } from "../../lib/tokenize";
import { isMaskableReviewMode, type ReviewMode, type ReviewScope } from "../../types/review";

// Single dispatch point for "which session component renders this mode" —
// the 3 mask-based modes share ReviewSession/useReviewSession; the 2 arcade
// modes each own their own component. Lives here (rather than in ReviewPage)
// so both the bulk flow (ReviewPage) and RandomReviewFlow share one switch
// without importing each other.
// onComplete (optional) fires exactly once when the session reaches its
// terminal state — pass or fail alike. Callers that only care about history
// (ReviewPage) omit it; the gate page uses it to reveal its Proceed button.
// `embedded` = rendered inside a host that owns its own chrome (the verse
// gate). It suppresses the session's own "Change Mode" button and the
// summary's "Back to Library" link, which don't make sense there.
// `verseReferences` (bulk collection review only) labels the per-verse
// accuracy breakdown, in review order. Forwarded only to the mask-based
// ReviewSession — the arcade branches don't take it and are left untouched.
// The reference is now appended to `tokens` by the single-verse callers (see
// buildVerseReviewTokens), so it recalls inline as part of the same session.
// `onHideReference` lets the host hide its own reference chrome (page heading,
// gate) once the player is ~25% through the verse.
interface RenderSessionOptions {
  mode: ReviewMode;
  scope: ReviewScope;
  tokens: Token[];
  onChangeMode: () => void;
  onComplete?: (outcome?: { accuracy: number; passed: boolean }) => void;
  embedded?: boolean;
  verseReferences?: string[];
  onHideReference?: (hidden: boolean) => void;
}

export function renderSession({
  mode,
  scope,
  tokens,
  onChangeMode,
  onComplete,
  embedded = false,
  verseReferences,
  onHideReference,
}: RenderSessionOptions) {
  if (isMaskableReviewMode(mode)) {
    return (
      <ReviewSession
        scope={scope}
        tokens={tokens}
        mode={mode}
        onChangeMode={onChangeMode}
        onComplete={onComplete}
        embedded={embedded}
        verseReferences={verseReferences}
        onHideReference={onHideReference}
      />
    );
  }
  // Arcade modes play each reference number as a single target (16, 12, 15)
  // rather than the text modes' per-digit tokens. The digit-run merge happens
  // INSIDE each arcade component (memoized), not here — computing it in this
  // render function would hand the arcade a fresh token array on every host
  // re-render (e.g. the ~25% reference-hide), which its hook reads as a new
  // stream and restarts the game.
  if (mode === "verse-defender") {
    return (
      <VerseDefenderSession
        scope={scope}
        tokens={tokens}
        onChangeMode={onChangeMode}
        onComplete={onComplete}
        embedded={embedded}
        onHideReference={onHideReference}
      />
    );
  }
  return (
    <LaneDefenderSession
      scope={scope}
      tokens={tokens}
      onChangeMode={onChangeMode}
      onComplete={onComplete}
      embedded={embedded}
      onHideReference={onHideReference}
    />
  );
}
