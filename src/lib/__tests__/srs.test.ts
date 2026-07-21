import { describe, expect, it } from "vitest";
import {
  INTERVAL_DAYS,
  MAX_BUCKET,
  SRS_LEVELS,
  applyReview,
  buildStudyQueue,
  daysUntilDue,
  dueLabel,
  frequencyLabel,
  isDue,
  modeForVerse,
  phaseOf,
  scheduleForBucket,
  selectDueFirst,
  summarizePool,
} from "../srs";
import type { Verse } from "../../types/verse";

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
  describe("Pass band (accuracy >= 90): advance one bucket", () => {
    it("climbs one bucket, extending dueAt by the new bucket's interval", () => {
      // New (undefined) → bucket 0, due in 1 day.
      const fromNew = applyReview(verse("v"), 100, NOW);
      expect(fromNew.srsBucket).toBe(0);
      expect(fromNew.dueAt).toBe(daysFromNow(1));

      // Learning (0) → bucket 1, due in 1 day. Exactly 90 counts as a pass.
      const fromLearning = applyReview(verse("v", { srsBucket: 0 }), 90, NOW);
      expect(fromLearning.srsBucket).toBe(1);
      expect(fromLearning.dueAt).toBe(daysFromNow(1));

      // Reviewing (2) → bucket 3, due in 7 days.
      const fromReviewing = applyReview(verse("v", { srsBucket: 2 }), 95, NOW);
      expect(fromReviewing.srsBucket).toBe(3);
      expect(fromReviewing.dueAt).toBe(daysFromNow(7));
    });

    it("caps the bucket at MAX_BUCKET on repeated passes", () => {
      const atMax = applyReview(verse("v", { srsBucket: MAX_BUCKET }), 100, NOW);
      expect(atMax.srsBucket).toBe(MAX_BUCKET);
      expect(atMax.dueAt).toBe(daysFromNow(INTERVAL_DAYS[MAX_BUCKET])); // 30 days
      expect(MAX_BUCKET).toBe(5);
    });
  });

  describe("Fail band (accuracy < 90): keep current bucket and dueAt", () => {
    it("does not change srsBucket or dueAt on fail", () => {
      // New verse (undefined) fails
      const fromNew = applyReview(verse("v"), 89, NOW);
      expect(fromNew.srsBucket).toBeUndefined();
      expect(fromNew.dueAt).toBeUndefined();

      // Learning verse (bucket 0) fails
      const due = daysFromNow(2);
      const fromLearning = applyReview(verse("v", { srsBucket: 0, dueAt: due }), 80, NOW);
      expect(fromLearning.srsBucket).toBe(0);
      expect(fromLearning.dueAt).toBe(due);

      // Reviewing verse (bucket 4) fails
      const fromReviewing = applyReview(verse("v", { srsBucket: 4, dueAt: due }), 50, NOW);
      expect(fromReviewing.srsBucket).toBe(4);
      expect(fromReviewing.dueAt).toBe(due);
    });
  });
});

describe("isDue", () => {
  it("new verses are never due (they're intake, not review)", () => {
    expect(isDue(verse("v"), NOW)).toBe(false);
  });

  it("learning verses (bucket 0) are due only once dueAt has passed", () => {
    expect(isDue(verse("v", { srsBucket: 0, dueAt: daysFromNow(-1) }), NOW)).toBe(true);
    expect(isDue(verse("v", { srsBucket: 0, dueAt: NOW }), NOW)).toBe(true);
    expect(isDue(verse("v", { srsBucket: 0, dueAt: daysFromNow(1) }), NOW)).toBe(false);
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

  it("treats bucket-0 (learning) as due once dueAt has passed, but never-studied (no srsBucket) as not due", () => {
    // Learning verse is due once dueAt is in the past, but not if it's in the future.
    const learningPoolDue = [verse("learn1", { srsBucket: 0, dueAt: daysFromNow(-1) })];
    expect(selectDueFirst(learningPoolDue, NOW)?.id).toBe("learn1");

    const learningPoolFuture = [verse("learn2", { srsBucket: 0, dueAt: daysFromNow(10) })];
    expect(selectDueFirst(learningPoolFuture, NOW)).toBeNull();

    const newPool = [verse("new1")];
    expect(selectDueFirst(newPool, NOW)).toBeNull();
  });
});

describe("buildStudyQueue", () => {
  it("returns due verses most-overdue first, excluding never-studied verses", () => {
    const verses = [
      verse("new1"),
      verse("learn1", { srsBucket: 0, dueAt: NOW }),
      verse("rev-soon", { srsBucket: 2, dueAt: daysFromNow(-1) }),
      verse("rev-old", { srsBucket: 3, dueAt: daysFromNow(-5) }),
      verse("rev-future", { srsBucket: 2, dueAt: daysFromNow(3) }), // not due
    ];
    const queue = buildStudyQueue({ verses, now: NOW, poolVerseIds: null });
    // New verses are never surfaced; the rest are ordered most-overdue first.
    expect(queue.map((item) => item.verse.id)).toEqual(["rev-old", "rev-soon", "learn1"]);
    expect(queue.map((item) => item.mode)).toEqual(["master-it", "master-it", "memorize-it"]);
  });

  it("is empty when nothing is due", () => {
    const verses = [verse("new1"), verse("rev-future", { srsBucket: 2, dueAt: daysFromNow(3) })];
    expect(buildStudyQueue({ verses, now: NOW, poolVerseIds: null })).toHaveLength(0);
  });

  it("scopes the pool to poolVerseIds when provided", () => {
    const verses = [
      verse("in-due", { srsBucket: 2, dueAt: daysFromNow(-1) }),
      verse("out-due", { srsBucket: 2, dueAt: daysFromNow(-1) }),
      verse("in-learn", { srsBucket: 0, dueAt: NOW }),
    ];
    const queue = buildStudyQueue({ verses, now: NOW, poolVerseIds: ["in-due", "in-learn"] });
    expect(queue.map((item) => item.verse.id)).toEqual(["in-due", "in-learn"]);
  });
});

describe("daysUntilDue", () => {
  it("returns null when the verse has no dueAt", () => {
    expect(daysUntilDue(verse("v"), NOW)).toBeNull();
    expect(daysUntilDue(verse("v", { srsBucket: 2 }), NOW)).toBeNull();
  });

  it("rounds up future days and goes <= 0 when due/overdue", () => {
    expect(daysUntilDue(verse("v", { dueAt: daysFromNow(3) }), NOW)).toBe(3);
    // A fractional remaining day still reads as a whole day.
    expect(daysUntilDue(verse("v", { dueAt: daysFromNow(0.5) }), NOW)).toBe(1);
    expect(daysUntilDue(verse("v", { dueAt: NOW }), NOW)).toBe(0); // exactly due
    expect(daysUntilDue(verse("v", { dueAt: daysFromNow(-2) }), NOW)).toBe(-2);
  });

  it("accepts a Date for now", () => {
    expect(daysUntilDue(verse("v", { dueAt: daysFromNow(5) }), new Date(NOW))).toBe(5);
  });
});

describe("frequencyLabel", () => {
  it("maps the bucket to a human label", () => {
    expect(frequencyLabel(verse("v"))).toBe("New"); // undefined
    expect(frequencyLabel(verse("v", { srsBucket: 0 }))).toBe("Daily");
    expect(frequencyLabel(verse("v", { srsBucket: 1 }))).toBe("Every 1d");
    expect(frequencyLabel(verse("v", { srsBucket: 3 }))).toBe("Every 7d");
    expect(frequencyLabel(verse("v", { srsBucket: 5 }))).toBe("Every 30d");
  });
});

describe("dueLabel", () => {
  it("summarizes the due status", () => {
    expect(dueLabel(verse("v"), NOW)).toBe("Not scheduled");
    expect(dueLabel(verse("v", { dueAt: NOW }), NOW)).toBe("Due now"); // <= 0
    expect(dueLabel(verse("v", { dueAt: daysFromNow(-1) }), NOW)).toBe("Due now");
    expect(dueLabel(verse("v", { dueAt: daysFromNow(3) }), NOW)).toBe("Due in 3d");
  });
});

describe("SRS_LEVELS", () => {
  it("covers every bucket 0..MAX_BUCKET in order", () => {
    expect(SRS_LEVELS.map((l) => l.bucket)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(SRS_LEVELS[0].label).toBe("Learning (daily)");
    expect(SRS_LEVELS[3].label).toBe("Every 7 days");
  });
});

describe("scheduleForBucket", () => {
  it("sets the bucket and restarts dueAt at now + the bucket's interval", () => {
    expect(scheduleForBucket(0, NOW)).toEqual({ srsBucket: 0, dueAt: daysFromNow(0) });
    expect(scheduleForBucket(3, NOW)).toEqual({ srsBucket: 3, dueAt: daysFromNow(7) });
    expect(scheduleForBucket(5, NOW)).toEqual({ srsBucket: 5, dueAt: daysFromNow(30) });
  });

  it("accepts a Date for now", () => {
    expect(scheduleForBucket(2, new Date(NOW))).toEqual({ srsBucket: 2, dueAt: daysFromNow(3) });
  });
});

describe("summarizePool", () => {
  it("buckets a mixed pool by phase and counts what's due", () => {
    const verses = [
      verse("new1"), // new — never due
      verse("new2"), // new
      verse("learn1", { srsBucket: 0 }), // learning — always due
      verse("rev-due", { srsBucket: 2, dueAt: daysFromNow(-1) }), // reviewing, due
      verse("rev-future", { srsBucket: 3, dueAt: daysFromNow(5) }), // reviewing, not due
      verse("mastered1", { srsBucket: MAX_BUCKET, dueAt: daysFromNow(-2) }), // mastered, overdue → due
      verse("mastered2", { srsBucket: MAX_BUCKET, dueAt: daysFromNow(10) }), // mastered, not due
    ];
    expect(summarizePool(verses, NOW)).toEqual({
      total: 7,
      newCount: 2,
      learningCount: 1,
      reviewingCount: 2, // buckets 1..4 (rev-due, rev-future)
      masteredCount: 2, // bucket 5 (MAX_BUCKET)
      dueCount: 3, // learn1 + rev-due + mastered1
    });
  });

  it("accepts a Date for now (equivalent to the ISO string)", () => {
    const verses = [verse("rev-due", { srsBucket: 1, dueAt: daysFromNow(-1) })];
    expect(summarizePool(verses, new Date(NOW))).toEqual(summarizePool(verses, NOW));
  });

  it("returns an all-zero summary for the empty pool", () => {
    expect(summarizePool([], NOW)).toEqual({
      total: 0,
      newCount: 0,
      learningCount: 0,
      reviewingCount: 0,
      masteredCount: 0,
      dueCount: 0,
    });
  });
});
