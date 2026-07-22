// Per-verse "mastery score": the average displayed accuracy across a verse's
// completed reviews in the recall modes. Type It (fully visible) and Memorize
// It (half visible) are deliberately excluded — only the modes that demand real
// recall count. Derived entirely from ReviewSession history; nothing extra is
// stored. A verse with no qualifying review scores 0.
import { getDisplayAccuracy, type ReviewMode, type ReviewSession } from "../types/review";

// The recall modes that contribute to a verse's score.
const SCORING_MODES: ReadonlySet<ReviewMode> = new Set<ReviewMode>([
  "master-it",
  "verse-defender",
  "lane-defender",
]);

// A session counts toward a single verse's score only when it reviewed that
// verse on its own. Collection/bulk runs store a single aggregate accuracy for
// the whole run, which can't be attributed to any one verse, so they're
// excluded here.
function countsForVerse(session: ReviewSession, verseId: string): boolean {
  return (
    SCORING_MODES.has(session.mode) &&
    session.scope.type === "verse" &&
    session.scope.verseId === verseId
  );
}

// A verse's contributing sessions, newest first — the raw history behind its
// score.
export function verseScoringSessions(
  sessions: ReviewSession[],
  verseId: string,
): ReviewSession[] {
  return sessions
    .filter((s) => countsForVerse(s, verseId))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

// A verse's score: the mean displayed accuracy across its contributing
// sessions, rounded to a whole number. 0 when it has never been completed in a
// scoring mode.
export function computeVerseScore(sessions: ReviewSession[], verseId: string): number {
  const relevant = sessions.filter((s) => countsForVerse(s, verseId));
  if (relevant.length === 0) return 0;
  const total = relevant.reduce((sum, s) => sum + getDisplayAccuracy(s.result), 0);
  return Math.round(total / relevant.length);
}

export interface VerseScore {
  score: number; // 0–100, rounded mean; 0 when count === 0
  count: number; // number of contributing sessions
}

// The per-verse mastery-score tooltip copy, shared by the Library and collection
// verse rows. `count` is the number of contributing (scoring-mode) sessions;
// 0 gives the "not scored yet" phrasing.
export function masteryScoreTooltip(count: number): string {
  return count > 0
    ? `Mastery score (0–100): your average accuracy across ${count} recall review${count === 1 ? "" : "s"} of this verse — Master It, Verse Defender, and Lane Defender.`
    : "Mastery score (0–100): your average recall accuracy for this verse. Review it in Master It, Verse Defender, or Lane Defender to build a score.";
}

// One-pass score for every verse that has any qualifying session, for callers
// (the Library list) that need scores across many verses at once. Verses absent
// from the map have no qualifying sessions and score 0.
export function computeVerseScores(sessions: ReviewSession[]): Map<string, VerseScore> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const session of sessions) {
    if (!SCORING_MODES.has(session.mode) || session.scope.type !== "verse") continue;
    const id = session.scope.verseId;
    const cur = totals.get(id) ?? { sum: 0, count: 0 };
    cur.sum += getDisplayAccuracy(session.result);
    cur.count += 1;
    totals.set(id, cur);
  }
  const scores = new Map<string, VerseScore>();
  for (const [id, { sum, count }] of totals) {
    scores.set(id, { score: Math.round(sum / count), count });
  }
  return scores;
}
