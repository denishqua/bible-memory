// "verse-defender" (tower-defense asteroids) and "lane-defender" (4-lane
// rhythm variant) are arcade modes that do NOT use the mask-based engine (see
// MaskableReviewMode below). Verse Defender is lives-based (ReviewResult's
// "lives" branch); Lane Defender scores per-word and reports an "accuracy"
// result like the typing modes.
export type ReviewMode = "type-it" | "memorize-it" | "master-it" | "verse-defender" | "lane-defender";

// Alias of ReviewMode used specifically by the masking engine (reviewModes.ts /
// useReviewSession.ts) so the compiler forces initialVisibility() to handle every
// case — a mode that isn't mask-based (verse-defender, lane-defender) should NOT
// be added to this alias, which would surface as a type error anywhere it's required.
export type MaskableReviewMode = "type-it" | "memorize-it" | "master-it";

export function isMaskableReviewMode(mode: ReviewMode): mode is MaskableReviewMode {
  return mode === "type-it" || mode === "memorize-it" || mode === "master-it";
}

export type ReviewScope =
  | { type: "verse"; verseId: string }
  | { type: "collection"; collectionId: string; verseIds: string[] };

// Discriminated union on `type`. The typing modes and Lane Defender construct
// "accuracy"; Verse Defender constructs "lives". Old Lane Defender history
// (pre-scoring change) may still carry "lives" records — getDisplayAccuracy
// handles both, so no migration is needed.
export type ReviewResult =
  | {
      type: "accuracy";
      accuracy: number; // 0–100
      totalKeystrokes: number;
      correctKeystrokes: number;
      passed: boolean; // accuracy >= 90
    }
  | {
      type: "lives";
      livesRemaining: number;
      totalKeystrokes: number;
      correctKeystrokes: number;
      passed: boolean;
    };

export interface ReviewSession {
  id: string;
  scope: ReviewScope;
  mode: ReviewMode;
  result: ReviewResult;
  startedAt: string;
  completedAt: string;
}

// Shared read-path helpers so downstream code (streak caller, history/summary UI)
// never branches on `result.type` itself.
export function isSessionQualifying(session: ReviewSession): boolean {
  return session.result.passed;
}

export function getDisplayAccuracy(result: ReviewResult): number {
  if (result.type === "accuracy") return result.accuracy;
  return result.totalKeystrokes === 0
    ? 100
    : Math.round((result.correctKeystrokes / result.totalKeystrokes) * 100);
}
