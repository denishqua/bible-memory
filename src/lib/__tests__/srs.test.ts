import { describe, expect, it } from "vitest";
import {
  INTERVAL_DAYS,
  MAX_BUCKET,
  applyReview,
  buildStudyQueue,
  computeStudyCounts,
  introducedTodayCount,
  isDue,
  modeForVerse,
  phaseOf,
  selectDueFirst,
} from "../srs";
import type { Verse } from "../../types/verse";
import type { ReviewMode, ReviewScope, ReviewSession } from "../../types/review";

const NOW = "2026-07-20T12:00:00.000Z";

function verse(id: string, srs: { srsBucket?: number; dueAt?: string } = {}): Verse {
  return {
    id,
    reference: `Ref ${id}`,
    text: "In the beginning",
    translation: "ESV",
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...srs,
  };
}

let sessionCounter = 0;
function session(
  verseId: string,
  completedAt: string,
  overrides: { mode?: ReviewMode; scope?: ReviewScope } = {},
): ReviewSession {
  sessionCounter += 1;
  return {
    id: `s${sessionCounter}`,
    scope: overrides.scope ?? { type: "verse", verseId },
    mode: overrides.mode ?? "type-it",
    result: { type: "accuracy", accuracy: 100, totalKeystrokes: 5, correctKeystrokes: 5, passed: true },
    startedAt: completedAt,
    completedAt,
  };
}

// now + n days, as ISO, so interval assertions don't hardcode wall-clock math.
function daysFromNow(days: number, from: string = NOW): string {
  return new Date(new Date(from).getTime() + days * 86_400_000).toISOString();
}

describe("phaseOf", () => {
  it("classifies by srsBucket", () => {
    expect(phaseOf(verse("v"))).toBe("new"); // undefined
    expect(phaseOf(verse("v", { srsBucket: 0 }))).toBe("learning");
    expect(phaseOf(verse("v", { srsBucket: 1 }))).toBe("reviewing");
    expect(phaseOf(verse("v", { srsBucket: 5 }))).toBe("reviewing");
  });
});

describe("modeForVerse", () => {
  it("ramps the mode with the phase", () => {
    expect(modeForVerse(verse("v"))).toBe("type-it"); // new
    expect(modeForVerse(verse("v", { srsBucket: 0 }))).toBe("memorize-it"); // learning
    expect(modeForVerse(verse("v", { srsBucket: 2 }))).toBe("master-it"); // reviewing
  });
});

describe("applyReview", () => {
  // onFailBehavior is irrelevant in the Pass/Hold bands; use "demote" as the
  // default arg there and vary it only in the Miss-band tests below.
  describe("Pass band (accuracy >= 90): advance one bucket", () => {
    it("climbs one bucket, extending dueAt by the new bucket's interval", () => {
      // New (undefined) → bucket 0, due same day (interval 0).
      const fromNew = applyReview(verse("v"), 100, NOW, "demote");
      expect(fromNew.srsBucket).toBe(0);
      expect(fromNew.dueAt).toBe(daysFromNow(INTERVAL_DAYS[0]));

      // Learning (0) → bucket 1, due in 1 day. Exactly 90 counts as a pass.
      const fromLearning = applyReview(verse("v", { srsBucket: 0 }), 90, NOW, "demote");
      expect(fromLearning.srsBucket).toBe(1);
      expect(fromLearning.dueAt).toBe(daysFromNow(1));

      // Reviewing (2) → bucket 3, due in 7 days.
      const fromReviewing = applyReview(verse("v", { srsBucket: 2 }), 95, NOW, "demote");
      expect(fromReviewing.srsBucket).toBe(3);
      expect(fromReviewing.dueAt).toBe(daysFromNow(7));
    });

    it("caps the bucket at MAX_BUCKET on repeated passes", () => {
      const atMax = applyReview(verse("v", { srsBucket: MAX_BUCKET }), 100, NOW, "demote");
      expect(atMax.srsBucket).toBe(MAX_BUCKET);
      expect(atMax.dueAt).toBe(daysFromNow(INTERVAL_DAYS[MAX_BUCKET])); // 30 days
      expect(MAX_BUCKET).toBe(5);
    });
  });

  describe("Hold band (85 <= accuracy < 90): stay put, no penalty", () => {
    it("keeps the current bucket regardless of onFailBehavior", () => {
      for (const behavior of ["demote", "hold"] as const) {
        const held = applyReview(verse("v", { srsBucket: 3 }), 87, NOW, behavior);
        expect(held.srsBucket).toBe(3);
        expect(held.dueAt).toBe(daysFromNow(INTERVAL_DAYS[3])); // 7 days
      }
    });

    it("floors a new verse at bucket 0 (never negative)", () => {
      expect(applyReview(verse("v"), 85, NOW, "hold").srsBucket).toBe(0);
    });
  });

  describe("Miss band (accuracy < 85)", () => {
    it("demote: eases off exactly one bucket, never resetting to 0 from a high bucket", () => {
      const demoted = applyReview(verse("v", { srsBucket: 4 }), 50, NOW, "demote");
      expect(demoted.srsBucket).toBe(3); // 4 -> 3, NOT 0
      expect(demoted.dueAt).toBe(daysFromNow(INTERVAL_DAYS[3]));
    });

    it("demote: floors at bucket 0", () => {
      expect(applyReview(verse("v", { srsBucket: 0 }), 10, NOW, "demote").srsBucket).toBe(0);
      expect(applyReview(verse("v"), 10, NOW, "demote").srsBucket).toBe(0);
    });

    it("hold: keeps the current bucket even on a bad miss", () => {
      const held = applyReview(verse("v", { srsBucket: 4 }), 20, NOW, "hold");
      expect(held.srsBucket).toBe(4);
      expect(held.dueAt).toBe(daysFromNow(INTERVAL_DAYS[4])); // 14 days
    });
  });
});

describe("isDue", () => {
  it("new verses are never due (they're intake, not review)", () => {
    expect(isDue(verse("v"), NOW)).toBe(false);
  });

  it("learning verses (bucket 0) are always due", () => {
    expect(isDue(verse("v", { srsBucket: 0, dueAt: daysFromNow(10) }), NOW)).toBe(true);
  });

  it("reviewing verses are due only once dueAt has passed", () => {
    expect(isDue(verse("v", { srsBucket: 2, dueAt: daysFromNow(-1) }), NOW)).toBe(true);
    expect(isDue(verse("v", { srsBucket: 2, dueAt: NOW }), NOW)).toBe(true); // <= now
    expect(isDue(verse("v", { srsBucket: 2, dueAt: daysFromNow(1) }), NOW)).toBe(false);
  });
});

describe("selectDueFirst", () => {
  it("returns null when nothing in the pool is due", () => {
    const pool = [
      verse("new1"), // new — never due
      verse("new2"),
      verse("rev-future", { srsBucket: 2, dueAt: daysFromNow(3) }), // not yet due
    ];
    expect(selectDueFirst(pool, NOW)).toBeNull();
  });

  it("returns the most-overdue due verse when several are due", () => {
    const pool = [
      verse("new1"), // new — excluded
      verse("rev-soon", { srsBucket: 2, dueAt: daysFromNow(-1) }),
      verse("rev-old", { srsBucket: 3, dueAt: daysFromNow(-5) }), // most overdue
      verse("rev-mid", { srsBucket: 2, dueAt: daysFromNow(-3) }),
    ];
    expect(selectDueFirst(pool, NOW)?.id).toBe("rev-old");
  });

  it("excludes excludeId when more than one due candidate exists", () => {
    const pool = [
      verse("rev-old", { srsBucket: 3, dueAt: daysFromNow(-5) }),
      verse("rev-mid", { srsBucket: 2, dueAt: daysFromNow(-3) }),
    ];
    // Skipping the most-overdue hands back the next-most-overdue.
    expect(selectDueFirst(pool, NOW, "rev-old")?.id).toBe("rev-mid");
  });

  it("still returns the only due verse even when it is the excludeId", () => {
    const pool = [
      verse("only-due", { srsBucket: 2, dueAt: daysFromNow(-1) }),
      verse("rev-future", { srsBucket: 2, dueAt: daysFromNow(3) }), // not due
    ];
    expect(selectDueFirst(pool, NOW, "only-due")?.id).toBe("only-due");
  });

  it("treats bucket-0 (learning) as due but never-studied (no srsBucket) as not due", () => {
    // Learning verse is due even with a far-future dueAt; the new verse is not.
    const learningPool = [verse("learn1", { srsBucket: 0, dueAt: daysFromNow(10) })];
    expect(selectDueFirst(learningPool, NOW)?.id).toBe("learn1");

    const newPool = [verse("new1")];
    expect(selectDueFirst(newPool, NOW)).toBeNull();
  });
});

describe("introducedTodayCount", () => {
  it("counts verses whose earliest session is today, once each", () => {
    const sessions = [
      session("a", NOW), // introduced today
      session("a", daysFromNow(0.1)), // same verse, still one
      session("b", daysFromNow(-3)), // introduced days ago
      session("b", NOW), // later review today — doesn't count b as new-today
      session("c", NOW), // introduced today
    ];
    expect(introducedTodayCount(sessions, NOW)).toBe(2); // a and c
  });

  it("ignores collection/bulk sessions", () => {
    const sessions = [
      session("a", NOW, { scope: { type: "collection", collectionId: "c1", verseIds: ["a"] } }),
    ];
    expect(introducedTodayCount(sessions, NOW)).toBe(0);
  });
});

describe("buildStudyQueue", () => {
  it("orders due reviews (most overdue first) → learning → new", () => {
    const verses = [
      verse("new1"),
      verse("learn1", { srsBucket: 0, dueAt: NOW }),
      verse("rev-soon", { srsBucket: 2, dueAt: daysFromNow(-1) }),
      verse("rev-old", { srsBucket: 3, dueAt: daysFromNow(-5) }),
      verse("rev-future", { srsBucket: 2, dueAt: daysFromNow(3) }), // not due
    ];
    const queue = buildStudyQueue({
      verses,
      sessions: [],
      newPerDay: 3,
      now: NOW,
      poolVerseIds: null,
    });
    expect(queue.map((item) => item.verse.id)).toEqual([
      "rev-old", // most overdue
      "rev-soon",
      "learn1",
      "new1",
    ]);
    // Each item carries the auto-picked mode for its phase.
    expect(queue.map((item) => item.mode)).toEqual([
      "master-it",
      "master-it",
      "memorize-it",
      "type-it",
    ]);
  });

  it("caps new verses at newPerDay minus those already introduced today", () => {
    const verses = [verse("n1"), verse("n2"), verse("n3"), verse("n4")];
    // Two verses already introduced today → only 1 new slot left (cap 3).
    const sessions = [session("x", NOW), session("y", NOW)];
    const queue = buildStudyQueue({ verses, sessions, newPerDay: 3, now: NOW, poolVerseIds: null });
    expect(queue.map((item) => item.verse.id)).toEqual(["n1"]);
  });

  it("adds no new verses once the daily cap is already met", () => {
    const verses = [verse("n1"), verse("n2")];
    const sessions = [session("x", NOW), session("y", NOW), session("z", NOW)];
    const queue = buildStudyQueue({ verses, sessions, newPerDay: 3, now: NOW, poolVerseIds: null });
    expect(queue).toHaveLength(0);
  });

  it("scopes every category to poolVerseIds when provided", () => {
    const verses = [
      verse("in-new"),
      verse("out-new"),
      verse("in-due", { srsBucket: 2, dueAt: daysFromNow(-1) }),
      verse("out-due", { srsBucket: 2, dueAt: daysFromNow(-1) }),
    ];
    const queue = buildStudyQueue({
      verses,
      sessions: [],
      newPerDay: 5,
      now: NOW,
      poolVerseIds: ["in-new", "in-due"],
    });
    expect(queue.map((item) => item.verse.id)).toEqual(["in-due", "in-new"]);
  });
});

describe("computeStudyCounts", () => {
  it("summarizes due / new-available / learning consistent with the queue", () => {
    const verses = [
      verse("new1"),
      verse("new2"),
      verse("learn1", { srsBucket: 0 }),
      verse("rev-due", { srsBucket: 2, dueAt: daysFromNow(-1) }),
      verse("rev-future", { srsBucket: 2, dueAt: daysFromNow(2) }),
    ];
    const counts = computeStudyCounts({
      verses,
      sessions: [],
      newPerDay: 3,
      now: NOW,
      poolVerseIds: null,
    });
    expect(counts).toEqual({ dueCount: 1, newAvailable: 2, learningCount: 1 });
  });

  it("clamps newAvailable to the remaining daily cap", () => {
    const verses = [verse("n1"), verse("n2"), verse("n3"), verse("n4")];
    const sessions = [session("x", NOW)]; // 1 introduced today, cap 3 → 2 left
    const counts = computeStudyCounts({ verses, sessions, newPerDay: 3, now: NOW, poolVerseIds: null });
    expect(counts.newAvailable).toBe(2);
  });

  it("respects poolVerseIds scoping", () => {
    const verses = [verse("a"), verse("b", { srsBucket: 0 })];
    const counts = computeStudyCounts({
      verses,
      sessions: [],
      newPerDay: 3,
      now: NOW,
      poolVerseIds: ["a"],
    });
    expect(counts).toEqual({ dueCount: 0, newAvailable: 1, learningCount: 0 });
  });
});
