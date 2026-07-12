import { useCallback, useEffect, useState } from "react";
import { useStorage } from "../data/storageContext";
import { createId } from "../data/ids";
import type { Verse } from "../types/verse";

export interface NewVerseInput {
  reference: string;
  text: string;
  translation: string;
  source: Verse["source"];
}

export interface EditVerseInput {
  reference: string;
  text: string;
  translation: string;
}

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

  const createVerse = useCallback(
    async (input: NewVerseInput): Promise<Verse> => {
      const now = new Date().toISOString();
      const verse: Verse = { id: createId(), createdAt: now, updatedAt: now, ...input };
      await storage.saveVerse(verse);
      await refresh();
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
    },
    [storage, refresh],
  );

  const deleteVerse = useCallback(
    async (id: string): Promise<void> => {
      await storage.deleteVerse(id);
      await refresh();
    },
    [storage, refresh],
  );

  return { verses, loading, createVerse, updateVerse, deleteVerse, refresh };
}
