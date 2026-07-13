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
export function renderSession(
  mode: ReviewMode,
  scope: ReviewScope,
  tokens: Token[],
  onChangeMode: () => void,
) {
  if (isMaskableReviewMode(mode)) {
    return <ReviewSession scope={scope} tokens={tokens} mode={mode} onChangeMode={onChangeMode} />;
  }
  if (mode === "verse-defender") {
    return <VerseDefenderSession scope={scope} tokens={tokens} onChangeMode={onChangeMode} />;
  }
  return <LaneDefenderSession scope={scope} tokens={tokens} onChangeMode={onChangeMode} />;
}
