import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useStorage } from "../data/storageContext";
import { useSettings, SETTINGS_UPDATED_EVENT } from "../hooks/useSettings";
import { PROFILE_UPDATED_EVENT } from "../hooks/useProfile";
import { useTheme, type ThemePreference } from "../hooks/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { Verse } from "../types/verse";
import type { Collection, CollectionVerseLink } from "../types/collection";
import type { ReviewSession } from "../types/review";
import type { Profile } from "../types/profile";
import type { Settings } from "../types/settings";

// Full-backup file shape produced by "Export data" below. Import accepts the
// same shape and merges it ADDITIVELY (upserts by id; never deletes).
interface BackupFile {
  version: number;
  exportedAt: string;
  verses: Verse[];
  collections: Collection[];
  links: CollectionVerseLink[];
  sessions: ReviewSession[];
  profile?: Profile;
  settings?: Settings;
}

type ImportStatus =
  | { kind: "idle" }
  | { kind: "importing" }
  | { kind: "done"; summary: string }
  | { kind: "error"; message: string };

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  marginBottom: "0.35rem",
};

const helperTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--color-ink-muted)",
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "0.6rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontFamily: "inherit",
  fontSize: "0.95rem",
};

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.verses) &&
    Array.isArray(v.collections) &&
    Array.isArray(v.links) &&
    Array.isArray(v.sessions)
  );
}

// "YYYY-MM-DD" strings compare correctly as plain strings; null loses to any date.
function laterDate(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a >= b ? a : b;
}

export function SettingsPage() {
  const storage = useStorage();
  const { settings, updateSettings } = useSettings();
  const { preference, setPreference } = useTheme();

  // --- ESV API key section state ---
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // Seed (and re-sync) the draft from storage. This also runs after a save or
  // an imported-settings broadcast, keeping the field consistent everywhere.
  useEffect(() => {
    if (settings) setKeyDraft(settings.esvApiKey);
  }, [settings]);

  useEffect(() => {
    if (!keySaved) return;
    const timer = window.setTimeout(() => setKeySaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [keySaved]);

  const savedKey = settings?.esvApiKey ?? "";

  async function saveKey(value: string) {
    if (!settings) return;
    await updateSettings({ ...settings, esvApiKey: value.trim() });
    setKeySaved(true);
  }

  const keyStatus = savedKey
    ? "Using your saved key."
    : "No key set — ESV lookup is unavailable until you add one.";

  // --- Data section state ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>({ kind: "idle" });
  const [exported, setExported] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!exported) return;
    const timer = window.setTimeout(() => setExported(false), 2000);
    return () => window.clearTimeout(timer);
  }, [exported]);

  async function handleExport() {
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
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file again re-triggers onChange.
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

      // Additive merge: saveVerse/saveCollection upsert by id, and
      // addVerseToCollection already dedups by (collectionId, verseId).
      for (const verse of parsed.verses) {
        await storage.saveVerse(verse);
      }
      for (const collection of parsed.collections) {
        await storage.saveCollection(collection);
      }
      for (const link of parsed.links) {
        await storage.addVerseToCollection(link);
      }

      // Sessions have no upsert path, so dedup by id here — re-importing the
      // same backup must not double-count review history.
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
        await storage.saveSettings(parsed.settings);
        window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
      }

      // Keep the CURRENT profile, but never let an older backup clobber a live
      // streak: take the max of each streak counter (and the later date).
      if (parsed.profile?.streak) {
        const current = await storage.getProfile();
        const imported = parsed.profile.streak;
        const merged: Profile = {
          ...current,
          streak: {
            currentStreak: Math.max(current.streak.currentStreak, imported.currentStreak ?? 0),
            longestStreak: Math.max(current.streak.longestStreak, imported.longestStreak ?? 0),
            lastQualifyingDate: laterDate(
              current.streak.lastQualifyingDate,
              imported.lastQualifyingDate ?? null,
            ),
          },
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
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      await storage.clearAll();
      window.location.reload();
    } catch {
      setClearing(false);
      setClearArmed(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "36rem", margin: "0 auto" }}>
      <h2 style={{ fontSize: "1.4rem" }}>Settings</h2>

      <Card>
        <h3 style={sectionTitleStyle}>ESV API Key</h3>
        <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
          Required for “Look Up (ESV)” when adding a verse — bring your own key. Get a free API
          token at{" "}
          <a href="https://api.esv.org/" target="_blank" rel="noreferrer" style={{ color: "var(--color-clay)" }}>
            api.esv.org
          </a>
          . Without a key you can still add verses manually.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <input
            id="esv-api-key"
            type={showKey ? "text" : "password"}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Paste your ESV API token"
            autoComplete="off"
            aria-label="ESV API key"
            style={inputStyle}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? "Hide" : "Show"}
          </Button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button
            type="button"
            variant="primary"
            onClick={() => saveKey(keyDraft)}
            disabled={!settings || keyDraft.trim() === savedKey}
          >
            Save Key
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => saveKey("")}
            disabled={!settings || (savedKey === "" && keyDraft.trim() === "")}
          >
            Clear key
          </Button>
          {keySaved ? (
            <span style={{ color: "var(--color-sage)", fontSize: "0.85rem" }}>Saved</span>
          ) : null}
        </div>
        <p style={{ ...helperTextStyle, marginTop: "0.75rem" }}>{keyStatus}</p>
      </Card>

      <Card>
        <h3 style={sectionTitleStyle}>Appearance</h3>
        <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
          “System” follows your device’s light/dark preference.
        </p>
        <div
          role="group"
          aria-label="Theme"
          style={{
            display: "inline-flex",
            border: "1px solid var(--color-border)",
            borderRadius: "0.6rem",
            overflow: "hidden",
          }}
        >
          {THEME_OPTIONS.map((option) => {
            const active = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreference(option.value)}
                aria-pressed={active}
                style={{
                  padding: "0.5rem 1.1rem",
                  fontSize: "0.9rem",
                  fontWeight: active ? 600 : 500,
                  border: "none",
                  cursor: "pointer",
                  background: active ? "var(--color-clay)" : "transparent",
                  color: active ? "var(--color-clay-contrast)" : "var(--color-ink-muted)",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 style={sectionTitleStyle}>Data</h3>
        <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
          Export everything (verses, collections, review history, streak, settings) as a JSON
          backup, or restore from one. Restoring merges into your existing data — it never
          deletes anything.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={handleExport}>
            Export data
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={importStatus.kind === "importing"}
          >
            {importStatus.kind === "importing" ? "Importing…" : "Import / Restore"}
          </Button>
          {exported ? (
            <span style={{ color: "var(--color-sage)", fontSize: "0.85rem" }}>Downloaded</span>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          style={{ display: "none" }}
        />
        {importStatus.kind === "done" ? (
          <p style={{ color: "var(--color-sage)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
            {importStatus.summary}
          </p>
        ) : null}
        {importStatus.kind === "error" ? (
          <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
            {importStatus.message}
          </p>
        ) : null}

        <div
          style={{
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {clearArmed ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ color: "var(--color-danger)", fontSize: "0.9rem", fontWeight: 600 }}>
                Really clear? This can’t be undone.
              </span>
              <Button type="button" variant="danger" onClick={handleClearAll} disabled={clearing}>
                {clearing ? "Clearing…" : "Yes, clear everything"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setClearArmed(false)} disabled={clearing}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button type="button" variant="danger" onClick={() => setClearArmed(true)}>
              Clear all data
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
