import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useStorage } from "../data/storageContext";
import { useSettings, SETTINGS_UPDATED_EVENT } from "../hooks/useSettings";
import { PROFILE_UPDATED_EVENT } from "../hooks/useProfile";
import { useTheme, type ThemePreference } from "../hooks/useTheme";
import { useCollections } from "../hooks/useCollections";
import { useVerses } from "../hooks/useVerses";
import { useReviewHistory } from "../hooks/useReviewHistory";
import { computeVerseScores } from "../lib/verseScore";
import { normalizeDomain } from "../lib/domainWhitelist";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { MODE_OPTIONS } from "../components/review/ModePicker";
import type { Verse } from "../types/verse";
import type { Collection, CollectionVerseLink } from "../types/collection";
import type { ReviewMode, ReviewSession } from "../types/review";
import { normalizeProfile, type Profile } from "../types/profile";
import { mergeSettings, type NewTabGateSettings, type Settings } from "../types/settings";

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

const GATE_TOGGLE_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

const REVIEW_INPUT_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: "First letter" },
  { value: true, label: "Whole word" },
];

const gateSubsectionStyle: React.CSSProperties = {
  marginTop: "1.25rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--color-border)",
};

const gateLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.9rem",
  fontWeight: 600,
  marginBottom: "0.4rem",
};

const gateSelectStyle: React.CSSProperties = {
  ...inputStyle,
  flex: undefined,
  width: "100%",
  cursor: "pointer",
};

// Small inline segmented control (used for the theme picker and the gate
// On/Off toggle) — one active segment, radio-group-like.
function SegmentedControl<T extends string | boolean>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        border: "1px solid var(--color-border)",
        borderRadius: "0.6rem",
        overflow: "hidden",
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
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
  );
}

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
        // Merge, never overwrite wholesale: a backup exported before the verse
        // gate existed has `{ esvApiKey }` only, and writing it as-is would
        // destroy the stored `newTabGate` config. Imported fields win over
        // current ones; anything the backup lacks keeps its current value
        // (and mergeSettings guarantees a fully-populated shape either way).
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

      // Keep the CURRENT profile, but never let an older backup clobber the
      // live practice count: take the max of the two. Since the count is
      // monotonic, re-importing a backup never double-counts and never lowers
      // the live value. normalizeProfile tolerates old-format backups (which
      // carry `streak` and no `versesPracticed` → treated as 0).
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
        <SegmentedControl
          ariaLabel="Theme"
          options={THEME_OPTIONS}
          value={preference}
          onChange={setPreference}
        />
      </Card>

      {settings ? (
        <Card>
          <h3 style={sectionTitleStyle}>Review input</h3>
          <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
            In the Type It / Memorize It / Master It modes, advance by typing just the first letter
            of each word, or the whole word.
          </p>
          <SegmentedControl
            ariaLabel="Review input style"
            options={REVIEW_INPUT_OPTIONS}
            value={settings.typeWholeWord}
            onChange={(value) => updateSettings({ ...settings, typeWholeWord: value })}
          />
        </Card>
      ) : null}

      {settings ? <VerseGateCard settings={settings} updateSettings={updateSettings} /> : null}

      <Card>
        <h3 style={sectionTitleStyle}>Data</h3>
        <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
          Export everything (verses, collections, review history, verses practiced, settings) as a JSON
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

// --- Verse Gate (extension new-tab gate) section ---
// Rendered only once settings has loaded, so `settings` is always non-null here
// and every write can safely spread the full object.
function VerseGateCard({
  settings,
  updateSettings,
}: {
  settings: Settings;
  updateSettings: (next: Settings) => Promise<void>;
}) {
  const gate = settings.newTabGate;
  const { collections, getVerseIdsForCollection } = useCollections();
  const { verses } = useVerses();
  const { sessions } = useReviewHistory();

  const [domainDraft, setDomainDraft] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

  // Cooldown minutes is a free-typed field: keep a draft so the user can clear
  // and retype, and only commit a valid whole number >= 1 (reverting the draft
  // on anything else). Re-seeded whenever the stored value changes.
  const [minutesDraft, setMinutesDraft] = useState(String(gate.cooldownMinutes));
  useEffect(() => {
    setMinutesDraft(String(gate.cooldownMinutes));
  }, [gate.cooldownMinutes]);

  // Same free-typed-draft treatment for the mastery threshold: commit only a
  // whole number clamped to 0–100, reverting the draft otherwise.
  const [thresholdDraft, setThresholdDraft] = useState(String(gate.masteryThreshold));
  useEffect(() => {
    setThresholdDraft(String(gate.masteryThreshold));
  }, [gate.masteryThreshold]);

  async function updateGate(patch: Partial<NewTabGateSettings>) {
    await updateSettings({ ...settings, newTabGate: { ...gate, ...patch } });
  }

  function commitMinutes() {
    const parsed = Math.floor(Number(minutesDraft));
    if (!Number.isFinite(parsed) || parsed < 1) {
      setMinutesDraft(String(gate.cooldownMinutes));
      return;
    }
    // Normalize the visible draft ("15.7" → "15") and commit only a real change.
    setMinutesDraft(String(parsed));
    if (parsed !== gate.cooldownMinutes) updateGate({ cooldownMinutes: parsed });
  }

  function commitThreshold() {
    const parsed = Math.floor(Number(thresholdDraft));
    // Revert on a blank field too: Number("") is 0 (a valid threshold), so
    // without this an empty input would silently commit 0 rather than restore.
    if (thresholdDraft.trim() === "" || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setThresholdDraft(String(gate.masteryThreshold));
      return;
    }
    setThresholdDraft(String(parsed));
    if (parsed !== gate.masteryThreshold) updateGate({ masteryThreshold: parsed });
  }

  // --- Whitelist ---
  function handleAddDomain() {
    const domain = normalizeDomain(domainDraft);
    if (!domain) {
      setDomainError("That doesn’t look like a valid domain (try something like “docs.google.com”).");
      return;
    }
    setDomainError(null);
    setDomainDraft("");
    if (gate.whitelist.includes(domain)) return;
    updateGate({ whitelist: [...gate.whitelist, domain] });
  }

  // --- Verse source ---
  // The deduped union of ids across every selected collection, in a stable
  // order (collection order, then verse order within each). A stored verseIds
  // subset is always intersected with this, so verses later removed from a
  // collection silently drop out of the pool. Memoized — this card also holds
  // controlled text inputs, so it re-renders on every keystroke.
  const collectionVerseIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const collectionId of gate.collectionIds) {
      for (const id of getVerseIdsForCollection(collectionId)) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [gate.collectionIds, getVerseIdsForCollection]);
  const versesById = useMemo(() => new Map(verses.map((v) => [v.id, v])), [verses]);
  const checkedIds = useMemo(
    () => new Set(gate.verseIds ?? collectionVerseIds),
    [gate.verseIds, collectionVerseIds],
  );
  const checkedCount = collectionVerseIds.filter((id) => checkedIds.has(id)).length;

  // How many of the currently-selected verses meet the mastery threshold — the
  // gate page applies the same filter, so this previews the real pool size and
  // powers the "nothing qualifies" warning below.
  const verseScores = useMemo(() => computeVerseScores(sessions), [sessions]);
  const masteryQualifyingCount = collectionVerseIds.filter(
    (id) => checkedIds.has(id) && (verseScores.get(id)?.score ?? 0) >= gate.masteryThreshold,
  ).length;

  function toggleVerse(verseId: string) {
    const next = new Set(checkedIds);
    if (next.has(verseId)) {
      next.delete(verseId);
    } else {
      next.add(verseId);
    }
    const subset = collectionVerseIds.filter((id) => next.has(id));
    // null means "the whole collection", so a full selection is stored as null —
    // verses added to the collection later are then included automatically.
    updateGate({ verseIds: subset.length === collectionVerseIds.length ? null : subset });
  }

  // Toggle a collection in/out of the gate's source set. Changing the set of
  // selected collections invalidates any verse subset (it belonged to the old
  // selection), so reset verseIds to null (the whole selection).
  function toggleCollection(collectionId: string) {
    const next = gate.collectionIds.includes(collectionId)
      ? gate.collectionIds.filter((id) => id !== collectionId)
      : [...gate.collectionIds, collectionId];
    updateGate({ collectionIds: next, verseIds: null });
  }

  // --- Warnings ---
  // The gate FAILS OPEN when unconfigured; make that loud.
  let warning: string | null = null;
  if (gate.enabled && gate.collectionIds.length === 0) {
    warning =
      "Gate is on but no collection is selected — navigation will NOT be blocked until you pick one.";
  } else if (
    gate.enabled &&
    gate.collectionIds.length > 0 &&
    gate.verseIds !== null &&
    checkedCount === 0
  ) {
    warning =
      "Gate is on but no verses are selected — navigation will NOT be blocked until you check at least one.";
  } else if (
    gate.enabled &&
    gate.masteryFilterEnabled &&
    checkedCount > 0 &&
    masteryQualifyingCount === 0
  ) {
    warning =
      `Gate is on but no selected verse has a mastery score of ${gate.masteryThreshold} or higher — ` +
      "navigation will NOT be blocked until one does (or lower the threshold).";
  }

  return (
    <Card>
      <h3 style={sectionTitleStyle}>Verse Gate</h3>
      <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
        When on, every new tab must complete a verse review before it can load a non-whitelisted
        site. (Only applies in the Chrome extension.)
      </p>
      <SegmentedControl
        ariaLabel="Verse gate"
        options={GATE_TOGGLE_OPTIONS}
        value={gate.enabled}
        onChange={(enabled) => updateGate({ enabled })}
      />
      {warning ? (
        <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", fontWeight: 600, marginTop: "0.75rem" }}>
          {warning}
        </p>
      ) : null}

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Whitelisted domains</span>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <input
            type="text"
            value={domainDraft}
            onChange={(e) => setDomainDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddDomain();
            }}
            placeholder="e.g. docs.google.com"
            autoComplete="off"
            aria-label="Domain to whitelist"
            style={inputStyle}
          />
          <Button type="button" variant="primary" onClick={handleAddDomain} disabled={domainDraft.trim() === ""}>
            Add
          </Button>
        </div>
        {domainError ? (
          <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginBottom: "0.6rem" }}>
            {domainError}
          </p>
        ) : null}
        {gate.whitelist.length > 0 ? (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.6rem" }}>
            {gate.whitelist.map((domain) => (
              <li key={domain} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ flex: 1, fontSize: "0.9rem" }}>{domain}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => updateGate({ whitelist: gate.whitelist.filter((d) => d !== domain) })}
                  aria-label={`Remove ${domain} from whitelist`}
                  style={{ padding: "0.25rem 0.7rem", fontSize: "0.8rem" }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <p style={helperTextStyle}>
          Only these sites load without a review. A domain also matches its subdomains.
        </p>
      </div>

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Verse source</span>
        {/* Multiple collections can feed the gate; their verses are pooled
            (deduped) into one review set. */}
        {collections.length === 0 ? (
          <p style={helperTextStyle}>Create a collection first — the gate draws its verses from one.</p>
        ) : (
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
              padding: "0.6rem 0.75rem",
              maxHeight: "14rem",
              overflowY: "auto",
            }}
          >
            {collections.map((collection) => (
              <label
                key={collection.id}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", padding: "0.15rem 0" }}
              >
                <input
                  type="checkbox"
                  checked={gate.collectionIds.includes(collection.id)}
                  onChange={() => toggleCollection(collection.id)}
                  style={{ accentColor: "var(--color-clay)" }}
                />
                {collection.name}
              </label>
            ))}
          </div>
        )}
        {gate.collectionIds.length > 0 ? (
          <div style={{ marginTop: "0.6rem" }}>
            <button
              type="button"
              onClick={() => setLimitOpen((v) => !v)}
              aria-expanded={limitOpen}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-clay)",
                fontFamily: "inherit",
              }}
            >
              {limitOpen ? "▾" : "▸"} Limit to specific verses
              {gate.verseIds !== null ? ` (${checkedCount} of ${collectionVerseIds.length})` : ""}
            </button>
            {limitOpen ? (
              <div
                style={{
                  marginTop: "0.5rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  padding: "0.6rem 0.75rem",
                  maxHeight: "14rem",
                  overflowY: "auto",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  <input
                    type="checkbox"
                    checked={collectionVerseIds.length > 0 && checkedCount === collectionVerseIds.length}
                    onChange={(e) => updateGate({ verseIds: e.target.checked ? null : [] })}
                    style={{ accentColor: "var(--color-clay)" }}
                  />
                  Select all
                </label>
                {collectionVerseIds.length === 0 ? (
                  <p style={helperTextStyle}>This collection has no verses yet.</p>
                ) : (
                  collectionVerseIds.map((verseId) => (
                    <label
                      key={verseId}
                      style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", padding: "0.15rem 0" }}
                    >
                      <input
                        type="checkbox"
                        checked={checkedIds.has(verseId)}
                        onChange={() => toggleVerse(verseId)}
                        style={{ accentColor: "var(--color-clay)" }}
                      />
                      {versesById.get(verseId)?.reference ?? "(unknown verse)"}
                    </label>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Mastery filter</span>
        <p style={{ ...helperTextStyle, marginBottom: "0.6rem" }}>
          When on, the gate only quizzes verses you’ve already learned — those whose mastery score
          is at or above the threshold. Verses below it are left out.
        </p>
        <SegmentedControl
          ariaLabel="Mastery filter"
          options={GATE_TOGGLE_OPTIONS}
          value={gate.masteryFilterEnabled}
          onChange={(masteryFilterEnabled) => updateGate({ masteryFilterEnabled })}
        />
        {gate.masteryFilterEnabled ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--color-ink-muted)" }}>
                Mastery score at least
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={thresholdDraft}
                onChange={(e) => setThresholdDraft(e.target.value)}
                onBlur={commitThreshold}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                aria-label="Minimum mastery score"
                style={{ ...inputStyle, flex: undefined, width: "5rem" }}
              />
            </div>
            {gate.collectionIds.length > 0 ? (
              <p style={{ ...helperTextStyle, marginTop: "0.6rem" }}>
                {masteryQualifyingCount} of {checkedCount} selected{" "}
                {checkedCount === 1 ? "verse" : "verses"} currently{" "}
                {masteryQualifyingCount === 1 ? "meets" : "meet"} this threshold.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div style={gateSubsectionStyle}>
        <label htmlFor="gate-mode" style={gateLabelStyle}>
          Review mode
        </label>
        <select
          id="gate-mode"
          value={gate.mode}
          onChange={(e) => updateGate({ mode: e.target.value as ReviewMode })}
          style={gateSelectStyle}
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Review cooldown</span>
        <p style={{ ...helperTextStyle, marginBottom: "0.6rem" }}>
          When on, completing any verse review (here at the gate or in a normal review or game)
          unlocks browsing for a set time — new tabs load without a review until it runs out. Each
          review you finish restarts the timer. When off, every new tab needs its own review.
        </p>
        <SegmentedControl
          ariaLabel="Review cooldown"
          options={GATE_TOGGLE_OPTIONS}
          value={gate.cooldownEnabled}
          onChange={(cooldownEnabled) => updateGate({ cooldownEnabled })}
        />
        {gate.cooldownEnabled ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={minutesDraft}
              onChange={(e) => setMinutesDraft(e.target.value)}
              onBlur={commitMinutes}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Cooldown duration in minutes"
              style={{ ...inputStyle, flex: undefined, width: "6rem" }}
            />
            <span style={{ fontSize: "0.9rem", color: "var(--color-ink-muted)" }}>
              minutes between reviews
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
