import type { StreakState } from "../types/profile";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" via local getFullYear/getMonth/getDate — NOT toISOString/UTC,
// which would shift the date across midnight for users west of UTC.
export function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Reconstructs a "YYYY-MM-DD" key as a local-midnight Date via new Date(y, m-1, d)
// — never `new Date(dateString)`, which parses date-only strings as UTC and can
// land on the wrong local day.
function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Local-midnight diff in whole days. Spec-review fix #3: round rather than
// truncate, so a 23- or 25-hour DST-boundary day still resolves to exactly 1
// (a truncating division could yield 0.958 or 1.041 and floor to 0 or 1
// inconsistently depending on which side of the transition the pair falls on).
export function daysBetween(a: string, b: string): number {
  const dateA = parseLocalDateKey(a);
  const dateB = parseLocalDateKey(b);
  return Math.round((dateB.getTime() - dateA.getTime()) / MS_PER_DAY);
}

// Pure, no hidden Date.now() — "now" is always passed in explicitly as completedAt.
// The accuracy >= 90 pass/fail gate lives in the caller (session-completion
// handler); this function only ever runs for sessions already known to qualify.
export function updateStreakOnQualifyingSession(
  current: StreakState,
  completedAt: Date,
): StreakState {
  const todayKey = toLocalDateKey(completedAt);

  // Same local day as the last qualifying session: no-op.
  if (current.lastQualifyingDate === todayKey) {
    return current;
  }

  let nextStreak: number;
  if (current.lastQualifyingDate === null) {
    nextStreak = 1;
  } else {
    const gap = daysBetween(current.lastQualifyingDate, todayKey);
    // Gap of exactly 1 day extends the streak; any other gap (missed a day, or
    // a non-positive gap from clock skew) resets to 1 — today counts as day 1
    // of the new streak, not 0.
    nextStreak = gap === 1 ? current.currentStreak + 1 : 1;
  }

  return {
    currentStreak: nextStreak,
    longestStreak: Math.max(current.longestStreak, nextStreak),
    lastQualifyingDate: todayKey,
  };
}
