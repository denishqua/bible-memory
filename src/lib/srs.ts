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

export interface StudyQueueParams {
  verses: Verse[];
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
// once its dueAt has arrived. New verses are NOT due — a verse only enters the
// SRS rotation the first time it's reviewed as a single verse (see applyReview),
// so buildStudyQueue never surfaces a never-studied verse.
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

// ── Per-verse schedule display + editing helpers ─────────────────────────────
// All pure, taking `now` explicitly (ISO string or Date) so components stay thin
// and everything is unit-testable without mocking the clock.

// The Leitner interval (in days) for a verse's CURRENT bucket, or null when the
// verse was never scheduled (undefined bucket → "New").
export function reviewIntervalDays(verse: Verse): number | null {
  if (verse.srsBucket === undefined) return null;
  return INTERVAL_DAYS[verse.srsBucket];
}

function toMillis(now: string | Date): number {
  return now instanceof Date ? now.getTime() : new Date(now).getTime();
}

// Whole days until the verse is due: null when not scheduled (no dueAt); else
// Math.ceil so a fractional remaining day still reads as "1 day" and a passed
// dueAt reads as <= 0 (due/overdue).
export function daysUntilDue(verse: Verse, now: string | Date): number | null {
  if (verse.dueAt === undefined) return null;
  return Math.ceil((new Date(verse.dueAt).getTime() - toMillis(now)) / 86_400_000);
}

// Frequency label from the current bucket: undefined → "New"; 0 → "Daily";
// else "Every Nd" (e.g. "Every 7d").
export function frequencyLabel(verse: Verse): string {
  if (verse.srsBucket === undefined) return "New";
  if (verse.srsBucket === 0) return "Daily";
  return `Every ${INTERVAL_DAYS[verse.srsBucket]}d`;
}

// Due-status label: not scheduled → "Not scheduled"; due now/overdue → "Due now";
// else "Due in Nd".
export function dueLabel(verse: Verse, now: string | Date): string {
  const days = daysUntilDue(verse, now);
  if (days === null) return "Not scheduled";
  if (days <= 0) return "Due now";
  return `Due in ${days}d`;
}

// Preset frequency levels for the verse-page dropdown, mapped to buckets.
export const SRS_LEVELS: { bucket: number; label: string }[] = [
  { bucket: 0, label: "Learning (daily)" },
  { bucket: 1, label: "Every 1 day" },
  { bucket: 2, label: "Every 3 days" },
  { bucket: 3, label: "Every 7 days" },
  { bucket: 4, label: "Every 14 days" },
  { bucket: 5, label: "Every 30 days" },
];

// Build the SRS state for a chosen bucket, restarting the countdown from `now`:
// dueAt = now + INTERVAL_DAYS[bucket] days. Used both for setting a frequency and
// for "restart countdown" (restart = scheduleForBucket(currentBucket, now)).
export function scheduleForBucket(bucket: number, now: string | Date): SrsState {
  const iso = now instanceof Date ? now.toISOString() : now;
  return { srsBucket: bucket, dueAt: addDays(iso, INTERVAL_DAYS[bucket]) };
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

// The ordered study queue, snapshotted once at session start: every DUE verse in
// the pool (Learning bucket 0 is always due; Reviewing once its dueAt has passed),
// most-overdue first. Never-studied ("new") verses are excluded — a verse joins
// the rotation only when it's first reviewed as a single verse (see applyReview).
// `poolVerseIds` scopes the pool (null = whole library).
export function buildStudyQueue(params: StudyQueueParams): StudyItem[] {
  const { verses, now, poolVerseIds } = params;
  return verses
    .filter(poolFilter(poolVerseIds))
    .filter((v) => isDue(v, now))
    .sort((a, b) => dueTime(a) - dueTime(b))
    .map(toItem);
}

// A full breakdown of a verse pool by SRS phase, plus how many are due for
// review right now. Used by the Study-tab due badge, the Study Today landing
// summary, and the progress dashboard. Buckets: undefined → new, 0 → learning,
// 1..4 → reviewing, 5 (MAX_BUCKET) → mastered.
export interface PoolSummary {
  total: number;
  newCount: number;
  learningCount: number;
  reviewingCount: number;
  masteredCount: number;
  // Verses where isDue is true (learning + reviewing whose dueAt has passed).
  // New verses are never due.
  dueCount: number;
}

// Pure — takes `now` explicitly (ISO string or Date) so it's unit-testable
// without touching the clock. phaseOf handles new/learning/reviewing; mastered
// is the top bucket (MAX_BUCKET), carved out of reviewing here for the dashboard.
export function summarizePool(verses: Verse[], now: string | Date): PoolSummary {
  const nowIso = now instanceof Date ? now.toISOString() : now;
  const summary: PoolSummary = {
    total: verses.length,
    newCount: 0,
    learningCount: 0,
    reviewingCount: 0,
    masteredCount: 0,
    dueCount: 0,
  };
  for (const verse of verses) {
    const phase = phaseOf(verse);
    if (phase === "new") {
      summary.newCount += 1;
    } else if (phase === "learning") {
      summary.learningCount += 1;
    } else if (verse.srsBucket === MAX_BUCKET) {
      summary.masteredCount += 1;
    } else {
      summary.reviewingCount += 1;
    }
    if (isDue(verse, nowIso)) summary.dueCount += 1;
  }
  return summary;
}
