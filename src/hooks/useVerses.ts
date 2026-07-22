import { useCallback, useEffect, useState } from "react";
import { useStorage } from "./useStorage";
import { createId } from "../data/ids";
import type { EditVerseInput, NewVerseInput, Verse } from "../types/verse";

export const VERSES_UPDATED_EVENT = "bm:verses-updated";

export function useVerses() {
  const storage = useStorage();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await storage.getVerses();
    setVerses(next);
    setLoading(false);
  }, [storage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleExternalUpdate = () => {
      refresh();
    };
    window.addEventListener(VERSES_UPDATED_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(VERSES_UPDATED_EVENT, handleExternalUpdate);
  }, [refresh]);

  const createVerse = useCallback(
    async (input: NewVerseInput): Promise<Verse> => {
      const now = new Date().toISOString();
      const verse: Verse = { id: createId(), createdAt: now, updatedAt: now, ...input };
      await storage.saveVerse(verse);
      await refresh();
      window.dispatchEvent(new Event(VERSES_UPDATED_EVENT));
      return verse;
    },
    [storage, refresh],
  );

  const updateVerse = useCallback(
    async (id: string, patch: EditVerseInput): Promise<void> => {
      const existing = await storage.getVerses();
      const current = existing.find((v) => v.id === id);
      if (!current) return;
      const updated: Verse = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await storage.saveVerse(updated);
      await refresh();
      window.dispatchEvent(new Event(VERSES_UPDATED_EVENT));
    },
    [storage, refresh],
  );

  // Writes only the SRS scheduling fields (srsBucket/dueAt) for a verse.
  // Deliberately NOT via updateVerse: SRS churn from a review isn't a content
  // edit, so it must not bump `updatedAt`. Read-modify-write so it never
  // clobbers other fields, then refresh so the UI reflects the new state.
  const setSrsState = useCallback(
    async (id: string, srs: { srsBucket?: number; dueAt?: string }): Promise<void> => {
      const existing = await storage.getVerses();
      const current = existing.find((v) => v.id === id);
      if (!current) return;
      const srsBucket = srs.srsBucket !== undefined ? srs.srsBucket : current.srsBucket;
      const dueAt = srs.dueAt !== undefined ? srs.dueAt : current.dueAt;
      await storage.saveVerse({ ...current, srsBucket, dueAt });
      await refresh();
      window.dispatchEvent(new Event(VERSES_UPDATED_EVENT));
    },
    [storage, refresh],
  );

  const deleteVerse = useCallback(
    async (id: string): Promise<void> => {
      await storage.deleteVerse(id);
      await refresh();
      window.dispatchEvent(new Event(VERSES_UPDATED_EVENT));
    },
    [storage, refresh],
  );

  return { verses, loading, createVerse, updateVerse, setSrsState, deleteVerse, refresh };
}
