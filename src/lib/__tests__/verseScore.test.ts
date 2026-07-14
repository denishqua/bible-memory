import { describe, expect, it } from "vitest";
import { computeVerseScore, computeVerseScores, verseScoringSessions } from "../verseScore";
import type { ReviewMode, ReviewResult, ReviewSession, ReviewScope } from "../../types/review";

let counter = 0;
function session(
  verseId: string,
  mode: ReviewMode,
  accuracy: number,
  overrides: { scope?: ReviewScope; completedAt?: string } = {},
): ReviewSession {
  counter += 1;
  const result: ReviewResult = {
    type: "accuracy",
    accuracy,
    totalKeystrokes: 10,
    correctKeystrokes: Math.round(accuracy / 10),
    passed: accuracy >= 90,
  };
  return {
    id: `s${counter}`,
    scope: overrides.scope ?? { type: "verse", verseId },
    mode,
    result,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: overrides.completedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("computeVerseScore", () => {
  it("is 0 when the verse has no scoring-mode sessions", () => {
    expect(computeVerseScore([], "v1")).toBe(0);
    expect(computeVerseScore([session("v1", "type-it", 100)], "v1")).toBe(0);
    expect(computeVerseScore([session("v1", "memorize-it", 100)], "v1")).toBe(0);
  });

  it("averages accuracy across the three scoring modes", () => {
    const sessions = [
      session("v1", "master-it", 80),
      session("v1", "verse-defender", 90),
      session("v1", "lane-defender", 100),
    ];
    expect(computeVerseScore(sessions, "v1")).toBe(90); // (80+90+100)/3
  });

  it("excludes Type It and Memorize It from the average", () => {
    const sessions = [
      session("v1", "master-it", 60),
      session("v1", "type-it", 100), // ignored
      session("v1", "memorize-it", 100), // ignored
    ];
    expect(computeVerseScore(sessions, "v1")).toBe(60);
  });

  it("only counts single-verse sessions, not collection/bulk runs", () => {
    const sessions = [
      session("v1", "master-it", 40, {
        scope: { type: "collection", collectionId: "c1", verseIds: ["v1", "v2"] },
      }),
    ];
    expect(computeVerseScore(sessions, "v1")).toBe(0);
  });

  it("counts every completed session, pass or fail, and rounds the mean", () => {
    const sessions = [
      session("v1", "master-it", 100),
      session("v1", "master-it", 0), // a bombed run still counts
    ];
    expect(computeVerseScore(sessions, "v1")).toBe(50);
  });

  it("scopes to the requested verse only", () => {
    const sessions = [session("v1", "master-it", 100), session("v2", "master-it", 20)];
    expect(computeVerseScore(sessions, "v1")).toBe(100);
    expect(computeVerseScore(sessions, "v2")).toBe(20);
  });
});

describe("verseScoringSessions", () => {
  it("returns contributing sessions newest first", () => {
    const older = session("v1", "master-it", 50, { completedAt: "2026-01-01T00:00:00.000Z" });
    const newer = session("v1", "lane-defender", 70, { completedAt: "2026-02-01T00:00:00.000Z" });
    const result = verseScoringSessions([older, newer], "v1");
    expect(result.map((s) => s.id)).toEqual([newer.id, older.id]);
  });
});

describe("computeVerseScores", () => {
  it("returns a per-verse score/count map in one pass", () => {
    const sessions = [
      session("v1", "master-it", 80),
      session("v1", "lane-defender", 100),
      session("v2", "verse-defender", 50),
      session("v3", "type-it", 100), // no scoring session -> absent
    ];
    const scores = computeVerseScores(sessions);
    expect(scores.get("v1")).toEqual({ score: 90, count: 2 });
    expect(scores.get("v2")).toEqual({ score: 50, count: 1 });
    expect(scores.has("v3")).toBe(false);
  });
});
