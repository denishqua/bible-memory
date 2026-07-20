// Spaced-repetition scheduling — ALL pure logic for the "Study Today" feature.
//
// Two derived concepts, both computed from data we already store on each Verse
// (the reserved `srsBucket` / `dueAt` fields) and from review history:
//
//   - Phase (from srsBucket): undefined → "new", 0 → "learning", >=1 → "reviewing".
//   - A Leitner review schedule: each pass climbs one bucket (longer interval),
//     each fail drops back to bucket 0 (due immediately).
//
// The difficulty of the auto-picked review mode ramps with the phase:
//   new → type-it (verse visible), learning → memorize-it (every other word
//   masked), reviewing → master-it (full recall).
//
// Everything here is a pure function taking an explicit `now` so it's fully
// unit-testable without mocking the clock — the flow/page components stay thin.
import type { Verse } from "../types/verse";
import type { ReviewSession } from "../types/review";
import type { MaskableReviewMode } from "../types/review";

// Leitner intervals in days, indexed by srsBucket (0..5). Bucket 0 is due the
// same day (interval 0); each higher bucket waits longer before resurfacing.
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

// Highest bucket — a verse can't climb past this (interval caps at 30 days).
export const MAX_BUCKET = INTERVAL_DAYS.length - 1;

// Accuracy bands for the review outcome (mirrors ReviewSession's own
// PASS_THRESHOLD of 90; FAIL_THRESHOLD carves out a forgiving middle band):
//   >= 90        → Pass  (advance one bucket)
//   85..<90      → Hold  (stay put, no penalty)
//   < 85         → Miss  (demote one bucket, or hold — configurable)
export const PASS_THRESHOLD = 90;
export const FAIL_THRESHOLD = 85;

// What a Miss (accuracy < FAIL_THRESHOLD) does to the bucket. Never resets to 0
// from a high bucket — the harshest option only eases off a single step.
export type OnFailBehavior = "demote" | "hold";

export type Phase = "new" | "learning" | "reviewing";

// One entry in the day's study queue: the verse, the auto-picked mode for it,
// and the phase it was in when the queue was snapshotted.
export interface StudyItem {
  verse: Verse;
  mode: MaskableReviewMode;
  phase: Phase;
}

// The SRS state written back to a verse after a review (see useVerses.setSrsState).
export interface SrsState {
  srsBucket: number;
  dueAt: string;
}

// Summary shown on the Study Today landing card.
export interface StudyCounts {
  dueCount: number;
  newAvailable: number;
  learningCount: number;
}

export interface StudyQueueParams {
  verses: Verse[];
  sessions: ReviewSession[];
  newPerDay: number;
  now: string;
  // null = the whole library; otherwise only verses whose id is in this list
  // are considered candidates (scopes the queue to selected collections).
  poolVerseIds: string[] | null;
}

// undefined bucket → never studied (New); 0 → still Learning (always due);
// >= 1 → Reviewing on an expanding schedule.
export function phaseOf(verse: Verse): Phase {
  if (verse.srsBucket === undefined) return "new";
  if (verse.srsBucket === 0) return "learning";
  return "reviewing";
}

// Difficulty ramps with phase (typing modes only — no arcade modes here).
export function modeForVerse(verse: Verse): MaskableReviewMode {
  const phase = phaseOf(verse);
  if (phase === "new") return "type-it";
  if (phase === "learning") return "memorize-it";
  return "master-it";
}

// "Due" is a review concept: Learning (bucket 0) is always due, Reviewing is due
// once its dueAt has arrived. New verses are NOT due — they're daily intake,
// handled separately (and capped) in buildStudyQueue.
export function isDue(verse: Verse, now: string): boolean {
  const phase = phaseOf(verse);
  if (phase === "new") return false;
  if (phase === "learning") return true;
  // Reviewing: due when dueAt has passed. A reviewing verse always has a dueAt
  // (applyReview sets one), but treat a missing one as due, never stuck.
  if (verse.dueAt === undefined) return true;
  return new Date(verse.dueAt).getTime() <= new Date(now).getTime();
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

// Apply a review outcome to a verse's SRS state, using a gracious three-band
// model. `accuracy` is the raw 0–100 score; `onFailBehavior` decides what a Miss
// does. The new bucket NEVER resets to 0 from a high bucket and never drops
// below 0 — the schedule eases off gradually rather than punishing a stumble:
//   Pass  (accuracy >= PASS_THRESHOLD): advance one bucket (capped at MAX_BUCKET).
//   Hold  (FAIL_THRESHOLD..<PASS):      stay on the current bucket, no penalty.
//   Miss  (accuracy < FAIL_THRESHOLD):  demote one bucket, or hold (configurable).
// In every band dueAt = now + INTERVAL_DAYS[newBucket] days. A brand-new verse
// (undefined bucket) lands at bucket 0 minimum after its first study, in all bands.
export function applyReview(
  verse: Verse,
  accuracy: number,
  now: string,
  onFailBehavior: OnFailBehavior,
): SrsState {
  const bucket = verse.srsBucket;
  let nextBucket: number;
  if (accuracy >= PASS_THRESHOLD) {
    nextBucket = Math.min(MAX_BUCKET, (bucket ?? -1) + 1);
  } else if (accuracy >= FAIL_THRESHOLD) {
    // Hold band — stay put (floor 0 so a new verse still lands at bucket 0).
    nextBucket = Math.max(0, bucket ?? 0);
  } else if (onFailBehavior === "demote") {
    nextBucket = Math.max(0, (bucket ?? 0) - 1);
  } else {
    nextBucket = Math.max(0, bucket ?? 0);
  }
  return { srsBucket: nextBucket, dueAt: addDays(now, INTERVAL_DAYS[nextBucket]) };
}

// Same calendar day in local time. Used to count verses first introduced today.
function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// The earliest completedAt per verse across single-verse sessions.
function earliestSessionByVerse(sessions: ReviewSession[]): Map<string, string> {
  const earliest = new Map<string, string>();
  for (const session of sessions) {
    if (session.scope.type !== "verse") continue;
    const current = earliest.get(session.scope.verseId);
    if (current === undefined || session.completedAt < current) {
      earliest.set(session.scope.verseId, session.completedAt);
    }
  }
  return earliest;
}

// How many verses were introduced (reviewed for the very first time) today —
// derived purely from history, so the daily new-verse cap can decrement across
// reloads with no extra storage. A verse counts if its EARLIEST ever session
// landed on the same calendar day as `now`.
export function introducedTodayCount(sessions: ReviewSession[], now: string): number {
  let count = 0;
  for (const at of earliestSessionByVerse(sessions).values()) {
    if (isSameDay(at, now)) count += 1;
  }
  return count;
}

function poolFilter(poolVerseIds: string[] | null): (verse: Verse) => boolean {
  if (poolVerseIds === null) return () => true;
  const ids = new Set(poolVerseIds);
  return (verse) => ids.has(verse.id);
}

function dueTime(verse: Verse): number {
  return verse.dueAt ? new Date(verse.dueAt).getTime() : 0;
}

// Pick the single verse the gate should surface, preferring reviews that are
// DUE (see isDue: Learning is always due, Reviewing once dueAt has passed; a
// brand-new verse with no srsBucket is NOT due). Among due verses the MOST
// OVERDUE wins (smallest dueTime first). When more than one due verse exists,
// `excludeId` is skipped so a Skip never hands back the verse on screen. Returns
// null when nothing is due — the caller then falls back to a random pick over
// the whole pool. Pure (no Math.random) so it's deterministic to unit-test.
export function selectDueFirst(
  pool: Verse[],
  now: string,
  excludeId?: string | null,
): Verse | null {
  const due = pool.filter((v) => isDue(v, now)).sort((a, b) => dueTime(a) - dueTime(b));
  if (due.length === 0) return null;
  const candidates = due.length > 1 ? due.filter((v) => v.id !== excludeId) : due;
  return candidates[0] ?? due[0];
}

function toItem(verse: Verse): StudyItem {
  return { verse, mode: modeForVerse(verse), phase: phaseOf(verse) };
}

// The day's ordered study queue, snapshotted once at session start:
//   1. Due reviews (Reviewing verses whose dueAt has passed), most-overdue first.
//   2. Learning verses (bucket 0), in the order given.
//   3. New verses, capped at newPerDay minus the count already introduced today.
// `poolVerseIds` scopes every category (null = whole library).
export function buildStudyQueue(params: StudyQueueParams): StudyItem[] {
  const { verses, sessions, newPerDay, now, poolVerseIds } = params;
  const pool = verses.filter(poolFilter(poolVerseIds));

  const due = pool
    .filter((v) => phaseOf(v) === "reviewing" && isDue(v, now))
    .sort((a, b) => dueTime(a) - dueTime(b));
  const learning = pool.filter((v) => phaseOf(v) === "learning");

  const remainingNew = Math.max(0, newPerDay - introducedTodayCount(sessions, now));
  const newVerses = pool.filter((v) => phaseOf(v) === "new").slice(0, remainingNew);

  return [...due, ...learning, ...newVerses].map(toItem);
}

// The landing-card summary. Consistent with buildStudyQueue: newAvailable is the
// number of new verses the queue would actually include today (respecting both
// the remaining daily cap and how many new verses exist in the pool).
export function computeStudyCounts(params: StudyQueueParams): StudyCounts {
  const { verses, sessions, newPerDay, now, poolVerseIds } = params;
  const pool = verses.filter(poolFilter(poolVerseIds));

  const dueCount = pool.filter((v) => phaseOf(v) === "reviewing" && isDue(v, now)).length;
  const learningCount = pool.filter((v) => phaseOf(v) === "learning").length;

  const remainingNew = Math.max(0, newPerDay - introducedTodayCount(sessions, now));
  const newInPool = pool.filter((v) => phaseOf(v) === "new").length;
  const newAvailable = Math.min(remainingNew, newInPool);

  return { dueCount, newAvailable, learningCount };
}
