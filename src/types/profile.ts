export interface Profile {
  createdAt: string;
  // Monotonic cumulative count: +1 per finished review session (any mode, pass
  // OR fail). A bulk collection review is ONE session → +1, not one per verse.
  // Lives here (mirroring where the old `streak` lived) so it updates live via
  // the existing PROFILE_UPDATED_EVENT plumbing.
  versesPracticed: number;
}

// Coerces an arbitrary stored/imported object to a valid Profile (mirrors the
// spirit of mergeSettings). Tolerates OLD stored profiles — a streak-era
// `{ createdAt, streak }` blob has no numeric `versesPracticed`, so it lands on
// 0 here (the storage layer may instead seed it from review history; see
// getProfile).
export function normalizeProfile(raw: unknown): Profile {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : new Date().toISOString(),
    versesPracticed:
      typeof obj.versesPracticed === "number" && Number.isFinite(obj.versesPracticed)
        ? obj.versesPracticed
        : 0,
  };
}
