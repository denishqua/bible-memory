import { describe, expect, it, vi } from "vitest";

// Pin a non-UTC, DST-observing timezone so the "local, not UTC" and DST
// assertions below are deterministic regardless of the machine running the
// suite. Node re-reads TZ at runtime on macOS/Linux, and this file runs in its
// own isolated Vitest worker, so it cannot leak into other test files.
// (vi.stubEnv rather than process.env — the app tsconfig has no Node globals.)
vi.stubEnv("TZ", "America/New_York");
import { daysBetween, toLocalDateKey, updateStreakOnQualifyingSession } from "../streak";
import type { StreakState } from "../../types/profile";

function streak(overrides: Partial<StreakState> = {}): StreakState {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastQualifyingDate: null,
    ...overrides,
  };
}

describe("toLocalDateKey", () => {
  it("uses the local calendar date, not UTC", () => {
    // 23:30 local in New York is 04:30 the NEXT day in UTC.
    const d = new Date(2026, 0, 1, 23, 30);
    expect(d.toISOString().slice(0, 10)).toBe("2026-01-02"); // sanity: TZ took effect
    expect(toLocalDateKey(d)).toBe("2026-01-01");
  });

  it("zero-pads month and day", () => {
    expect(toLocalDateKey(new Date(2026, 2, 5, 12, 0))).toBe("2026-03-05");
  });
});

describe("daysBetween", () => {
  it("computes whole-day gaps", () => {
    expect(daysBetween("2026-07-10", "2026-07-13")).toBe(3);
    expect(daysBetween("2026-07-13", "2026-07-13")).toBe(0);
    expect(daysBetween("2026-07-13", "2026-07-12")).toBe(-1);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("returns exactly 1 across the 23-hour spring-forward day (DST-safe)", () => {
    // March 8, 2026 is spring-forward in America/New_York: midnight-to-midnight
    // is only 23 hours. Truncation would floor 0.958 to 0.
    expect(daysBetween("2026-03-08", "2026-03-09")).toBe(1);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });

  it("returns exactly 1 across the 25-hour fall-back day", () => {
    // November 1, 2026 is fall-back: a 25-hour day.
    expect(daysBetween("2026-11-01", "2026-11-02")).toBe(1);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("updateStreakOnQualifyingSession", () => {
  it("starts a streak of 1 when there is no prior qualifying date", () => {
    const next = updateStreakOnQualifyingSession(streak(), new Date(2026, 6, 13, 9, 0));
    expect(next).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastQualifyingDate: "2026-07-13",
    });
  });

  it("is a no-op for a repeat session on the same local day", () => {
    const current = streak({
      currentStreak: 4,
      longestStreak: 6,
      lastQualifyingDate: "2026-07-13",
    });
    const next = updateStreakOnQualifyingSession(current, new Date(2026, 6, 13, 22, 0));
    expect(next).toBe(current); // same object, no state churn
  });

  it("increments when the last qualifying day was exactly yesterday", () => {
    const current = streak({
      currentStreak: 4,
      longestStreak: 6,
      lastQualifyingDate: "2026-07-12",
    });
    const next = updateStreakOnQualifyingSession(current, new Date(2026, 6, 13, 7, 30));
    expect(next.currentStreak).toBe(5);
    expect(next.longestStreak).toBe(6);
    expect(next.lastQualifyingDate).toBe("2026-07-13");
  });

  it("resets to 1 after a gap of more than one day, preserving longestStreak", () => {
    const current = streak({
      currentStreak: 9,
      longestStreak: 9,
      lastQualifyingDate: "2026-07-01",
    });
    const next = updateStreakOnQualifyingSession(current, new Date(2026, 6, 13, 7, 30));
    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(9);
    expect(next.lastQualifyingDate).toBe("2026-07-13");
  });

  it("resets to 1 on a non-positive gap (clock skew backwards)", () => {
    const current = streak({
      currentStreak: 5,
      longestStreak: 5,
      lastQualifyingDate: "2026-07-14",
    });
    const next = updateStreakOnQualifyingSession(current, new Date(2026, 6, 13, 7, 30));
    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(5);
  });

  it("advances longestStreak once the current streak passes it", () => {
    const current = streak({
      currentStreak: 6,
      longestStreak: 6,
      lastQualifyingDate: "2026-07-12",
    });
    const next = updateStreakOnQualifyingSession(current, new Date(2026, 6, 13, 7, 30));
    expect(next.currentStreak).toBe(7);
    expect(next.longestStreak).toBe(7);
  });

  it("extends the streak across the spring-forward DST boundary", () => {
    const current = streak({
      currentStreak: 2,
      longestStreak: 2,
      lastQualifyingDate: "2026-03-08",
    });
    const next = updateStreakOnQualifyingSession(current, new Date(2026, 2, 9, 8, 0));
    expect(next.currentStreak).toBe(3);
  });
});
