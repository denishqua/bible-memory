import { useState, type ChangeEvent } from "react";
import { useStorage } from "./useStorage";
import { SETTINGS_UPDATED_EVENT } from "./useSettings";
import { PROFILE_UPDATED_EVENT } from "./useProfile";
import type { Verse } from "../types/verse";
import type { Collection, CollectionVerseLink } from "../types/collection";
import type { ReviewSession } from "../types/review";
import { normalizeProfile, type Profile } from "../types/profile";
import { mergeSettings, type Settings } from "../types/settings";

export interface BackupFile {
  version: number;
  exportedAt: string;
  verses: Verse[];
  collections: Collection[];
  links: CollectionVerseLink[];
  sessions: ReviewSession[];
  profile?: Profile;
  settings?: Settings;
}

export type ImportStatus =
  | { kind: "idle" }
  | { kind: "importing" }
  | { kind: "done"; summary: string }
  | { kind: "error"; message: string };

export function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.verses) &&
    Array.isArray(v.collections) &&
    Array.isArray(v.links) &&
    Array.isArray(v.sessions)
  );
}

export function useDataBackup() {
  const storage = useStorage();
  const [importStatus, setImportStatus] = useState<ImportStatus>({ kind: "idle" });
  const [exported, setExported] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleExport = async () => {
    const [verses, collections, links, sessions, profile, currentSettings] = await Promise.all([
      storage.getVerses(),
      storage.getCollections(),
      storage.getCollectionLinks(),
      storage.getReviewSessions(),
      storage.getProfile(),
      storage.getSettings(),
    ]);
    const backup: BackupFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      verses,
      collections,
      links,
      sessions,
      profile,
      settings: currentSettings,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bible-memory-backup.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 2000);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportStatus({ kind: "importing" });
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isBackupFile(parsed)) {
        setImportStatus({
          kind: "error",
          message: "That file doesn't look like a Bible Memory backup — nothing was imported.",
        });
        return;
      }

      for (const verse of parsed.verses) {
        await storage.saveVerse(verse);
      }
      for (const collection of parsed.collections) {
        await storage.saveCollection(collection);
      }
      for (const link of parsed.links) {
        await storage.addVerseToCollection(link);
      }

      const existingSessions = await storage.getReviewSessions();
      const existingIds = new Set(existingSessions.map((s) => s.id));
      let sessionsAdded = 0;
      for (const session of parsed.sessions) {
        if (existingIds.has(session.id)) continue;
        await storage.appendReviewSession(session);
        existingIds.add(session.id);
        sessionsAdded += 1;
      }

      if (parsed.settings && typeof parsed.settings.esvApiKey === "string") {
        const currentSettings = await storage.getSettings();
        await storage.saveSettings(
          mergeSettings({
            ...currentSettings,
            ...parsed.settings,
            newTabGate: { ...currentSettings.newTabGate, ...parsed.settings.newTabGate },
          }),
        );
        window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
      }

      if (parsed.profile) {
        const current = await storage.getProfile();
        const imported = normalizeProfile(parsed.profile);
        const merged: Profile = {
          ...current,
          versesPracticed: Math.max(current.versesPracticed, imported.versesPracticed),
        };
        await storage.saveProfile(merged);
        window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      }

      setImportStatus({
        kind: "done",
        summary:
          `Imported ${parsed.verses.length} verses, ${parsed.collections.length} collections, ` +
          `${parsed.links.length} links, and ${sessionsAdded} new review sessions.`,
      });
    } catch {
      setImportStatus({
        kind: "error",
        message: "Couldn't read that file — make sure it's a JSON backup exported from this app.",
      });
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await storage.clearAll();
      window.location.reload();
    } catch {
      setClearing(false);
      setClearArmed(false);
    }
  };

  return {
    importStatus,
    exported,
    clearArmed,
    setClearArmed,
    clearing,
    handleExport,
    handleImportFile,
    handleClearAll,
  };
}
