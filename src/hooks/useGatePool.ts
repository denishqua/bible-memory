import { useState, useEffect, useMemo, useCallback } from "react";
import type { Verse } from "../types/verse";
import type { Settings } from "../types/settings";
import { selectDueFirst } from "../lib/srs";

export function parseTargetUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function pickRandomVerse(pool: Verse[], excludeId: string | null): Verse | null {
  const candidates = pool.length > 1 ? pool.filter((v) => v.id !== excludeId) : pool;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

interface UseGatePoolParams {
  settings: Settings | null;
  verses: Verse[];
  unionVerseIds: (ids: string[]) => string[];
  loading: boolean;
}

export function useGatePool({ settings, verses, unionVerseIds, loading }: UseGatePoolParams) {
  const targetUrl = useMemo(
    () => parseTargetUrl(new URLSearchParams(window.location.search).get("gateTarget")),
    [],
  );
  const targetHost = useMemo(() => (targetUrl ? new URL(targetUrl).hostname : null), [targetUrl]);

  const gate = settings?.newTabGate;

  const pool = useMemo<Verse[]>(() => {
    const legacyId = (gate as { collectionId?: string | null } | undefined)?.collectionId;
    const collectionIds = gate?.collectionIds ?? (legacyId ? [legacyId] : []);
    if (collectionIds.length === 0) return [];
    const byId = new Map(verses.map((v) => [v.id, v] as const));
    let ids = unionVerseIds(collectionIds);
    if (gate?.verseIds != null) {
      const wanted = new Set(gate.verseIds);
      ids = ids.filter((id) => wanted.has(id));
    }
    return ids.map((id) => byId.get(id)).filter((v): v is Verse => v !== undefined);
  }, [gate, verses, unionVerseIds]);

  const [currentVerseId, setCurrentVerseId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [hideReference, setHideReference] = useState(false);

  useEffect(() => {
    if (loading || pool.length === 0) return;
    const now = new Date().toISOString();
    const prioritizeDue = gate?.prioritizeDue !== false;
    setCurrentVerseId((prev) =>
      prev !== null && pool.some((v) => v.id === prev)
        ? prev
        : (((prioritizeDue ? selectDueFirst(pool, now, null) : null) ?? pickRandomVerse(pool, null))?.id ?? null),
    );
  }, [loading, pool, gate?.prioritizeDue]);

  const handleSkip = useCallback(() => {
    const now = new Date().toISOString();
    const prioritizeDue = gate?.prioritizeDue !== false;
    const next = (prioritizeDue ? selectDueFirst(pool, now, currentVerseId) : null) ?? pickRandomVerse(pool, currentVerseId);
    if (!next) return;
    setCurrentVerseId(next.id);
    setCompleted(false);
    setHideReference(false);
  }, [pool, currentVerseId, gate?.prioritizeDue]);

  return {
    gate,
    pool,
    targetUrl,
    targetHost,
    currentVerseId,
    setCurrentVerseId,
    completed,
    setCompleted,
    hideReference,
    setHideReference,
    handleSkip,
  };
}
