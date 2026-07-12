// "verse-defender" joins this union in a follow-up phase.
export type ReviewMode = "type-it" | "memorize-it" | "master-it";

// Alias of ReviewMode used specifically by the masking engine (reviewModes.ts /
// useReviewSession.ts) so the compiler forces initialVisibility() to handle every
// case — a future mode that isn't mask-based (e.g. "verse-defender") should NOT be
// added to this alias, which would surface as a type error anywhere it's required.
export type MaskableReviewMode = "type-it" | "memorize-it" | "master-it";

export type ReviewScope =
  | { type: "verse"; verseId: string }
  | { type: "collection"; collectionId: string; verseIds: string[] };

// Discriminated union on `type`. Only "accuracy" is constructed by the 3 modes in
// this phase — "lives" exists so a future lives-based Verse Defender mode can be
// added with zero migration of existing ReviewSession history.
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
