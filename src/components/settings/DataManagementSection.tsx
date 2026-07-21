import { useRef, useState, type ChangeEvent } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ConfirmActionButton } from "../ui/ConfirmActionButton";
import type { Verse } from "../../types/verse";
import type { Collection, CollectionVerseLink } from "../../types/collection";
import type { ReviewSession } from "../../types/review";
import type { Profile } from "../../types/profile";
import type { Settings } from "../../types/settings";
import { normalizeProfile } from "../../types/profile";
import { mergeSettings } from "../../types/settings";

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

export interface DataManagementSectionProps {
  verses: Verse[];
  collections: Collection[];
  links: CollectionVerseLink[];
  sessions: ReviewSession[];
  profile: Profile;
  settings: Settings;
  onImportBackup: (backup: BackupFile) => Promise<string>;
  onClearAllData: () => Promise<void>;
}

export function DataManagementSection({
  verses,
  collections,
  links,
  sessions,
  profile,
  settings,
  onImportBackup,
  onClearAllData,
}: DataManagementSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleExport = () => {
    const backup: BackupFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      verses,
      collections,
      links,
      sessions,
      profile,
      settings,
    };
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bible-memory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportStatus("Importing...");
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupFile>;
      if (!Array.isArray(parsed.verses)) {
        throw new Error("Invalid backup file format");
      }
      const summary = await onImportBackup({
        version: parsed.version ?? 1,
        exportedAt: parsed.exportedAt ?? new Date().toISOString(),
        verses: parsed.verses ?? [],
        collections: parsed.collections ?? [],
        links: parsed.links ?? [],
        sessions: parsed.sessions ?? [],
        profile: parsed.profile ? normalizeProfile(parsed.profile) : undefined,
        settings: parsed.settings ? mergeSettings(parsed.settings) : undefined,
      });
      setImportStatus(summary);
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : "Failed to import backup.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h2 style={{ fontSize: "1.1rem" }}>Data & Backup</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--color-ink-muted)", marginTop: "0.2rem" }}>
          Export your entire library, history, collections, and settings to a JSON file, or restore from a previous backup.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <Button variant="secondary" onClick={handleExport}>
          Export Backup JSON
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import / Restore Backup
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <ConfirmActionButton
          initialLabel="Clear All Data"
          confirmLabel="Confirm Clear All Data"
          onConfirm={onClearAllData}
        />
      </div>

      {importStatus ? (
        <span style={{ fontSize: "0.85rem", color: "var(--color-sage)" }}>{importStatus}</span>
      ) : null}
    </Card>
  );
}
