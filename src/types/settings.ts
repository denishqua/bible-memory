import type { ReviewMode } from "./review";
import type { OnFailBehavior } from "../lib/srs";

// Settings for the extension's "verse gate": every new tab's first http(s)
// navigation is intercepted and redirected to a full-screen review unless the
// destination domain is whitelisted (whitelist-only — everything else is
// gated). Completing a review unlocks that tab for the rest of its life.
//
// NOTE: the background service worker (src/extension/background.ts) reads
// this block directly from chrome.storage.local under `bm.settings.v1` — it
// cannot import this file (it is copied verbatim, unbundled), so any field
// rename here must be mirrored there by hand.
export interface NewTabGateSettings {
  enabled: boolean;
  // Bare domains ("google.com") — a domain matches its host and all
  // subdomains. Normalized via normalizeDomain() in src/lib/domainWhitelist.ts.
  whitelist: string[];
  // Verse pool: one or more collections, optionally narrowed to a subset of
  // their combined verses. An empty array = unconfigured — the gate FAILS OPEN
  // (never blocks).
  collectionIds: string[];
  // null = every verse across the selected collections; otherwise the selected
  // subset (applied to the UNION of those collections' verses).
  verseIds: string[] | null;
  // Optional mastery filter, applied AFTER the collection/verseIds selection:
  // when on, the pool is narrowed to verses whose mastery score (0–100, see
  // src/lib/verseScore.ts) is >= masteryThreshold, so the gate only quizzes
  // verses you've already learned to that level. Mastery is derived from review
  // history, which the background worker never reads — so the worker ignores
  // this filter and the gate PAGE applies it, failing open (as always) when
  // nothing qualifies.
  masteryFilterEnabled: boolean;
  masteryThreshold: number; // 0–100
  // The single review mode used by the gate (verses are random, mode is not).
  mode: ReviewMode;
  // Cooldown: once ANY verse review is completed (at the gate OR in a normal
  // review/game session), browsing is un-gated for `cooldownMinutes`; every
  // completed review restarts that window. When off, every gated navigation
  // requires its own review (the original behavior). The last-review timestamp
  // itself is NOT stored here — it lives under its own storage key
  // (`bm.gateCooldown.v1`) so it can't be clobbered by a settings save or
  // carried around in exported backups.
  cooldownEnabled: boolean;
  cooldownMinutes: number;
}

export function defaultNewTabGateSettings(): NewTabGateSettings {
  return {
    enabled: false,
    whitelist: [],
    collectionIds: [],
    verseIds: null,
    masteryFilterEnabled: false,
    masteryThreshold: 80,
    mode: "type-it",
    cooldownEnabled: false,
    cooldownMinutes: 15,
  };
}

// Settings for the "Study Today" spaced-repetition scheduler.
export interface SchedulerSettings {
  // Max brand-new verses introduced per day (the daily intake cap).
  newVersesPerDay: number;
  // null = draw new/due verses from the whole library; otherwise scope the
  // study pool to the union of these collections' verses.
  collectionIds: string[] | null;
  // What a Miss (accuracy < FAIL_THRESHOLD) does to a verse's bucket:
  // "demote" eases off one step, "hold" keeps the bucket. Never resets to 0.
  onFailBehavior: OnFailBehavior;
}

export function defaultSchedulerSettings(): SchedulerSettings {
  return { newVersesPerDay: 3, collectionIds: null, onFailBehavior: "demote" };
}

// App-level user settings, persisted as a single object under `bm.settings.v1`
// so future fields can be added without new storage keys.
export interface Settings {
  // ESV API token entered by the user at runtime. Empty string means "no key",
  // in which case ESV lookup is unavailable (manual verse entry still works).
  // There is no bundled/built-in key — each user supplies their own.
  esvApiKey: string;
  // Review input style for the three mask modes: false = type only the first
  // letter of each word to advance (default), true = type the whole word.
  // App-level (not gate-specific) — the extension background worker only reads
  // newTabGate, so this needs no worker mirroring.
  typeWholeWord: boolean;
  newTabGate: NewTabGateSettings;
  scheduler: SchedulerSettings;
}

export function defaultSettings(): Settings {
  return {
    esvApiKey: "",
    typeWholeWord: false,
    newTabGate: defaultNewTabGateSettings(),
    scheduler: defaultSchedulerSettings(),
  };
}

// Fills a (possibly partial) stored/imported settings object out to a full
// Settings. `newTabGate` is DEEP-merged over its defaults so a blob saved
// before a nested field existed still comes back fully populated — a shallow
// `{ ...defaults, ...partial }` would keep a stale partial gate block as-is.
export function mergeSettings(partial: Partial<Settings> | undefined | null): Settings {
  const defaults = defaultSettings();
  if (!partial) return defaults;
  // Migrate the legacy single-collection gate: blobs saved before the gate
  // supported multiple collections carried `collectionId: string | null`
  // instead of `collectionIds`. Lift a legacy id into the array (only when the
  // new shape isn't already present) and drop the dead key so it can't linger.
  const rawGate = (partial.newTabGate ?? {}) as Partial<NewTabGateSettings> & {
    collectionId?: string | null;
  };
  const { collectionId: legacyCollectionId, ...gateRest } = rawGate;
  const gate: Partial<NewTabGateSettings> = { ...gateRest };
  // Also drop the removed `snooze` field if an old blob still carries it, so it
  // doesn't linger in the persisted settings the same way collectionId would.
  delete (gate as { snoozeUntil?: unknown }).snoozeUntil;
  if (gate.collectionIds === undefined && legacyCollectionId) {
    gate.collectionIds = [legacyCollectionId];
  }
  return {
    ...defaults,
    ...partial,
    newTabGate: { ...defaultNewTabGateSettings(), ...gate },
    // Deep-merge like newTabGate so a blob saved before `scheduler` (or a nested
    // field of it) existed still comes back fully populated.
    scheduler: { ...defaultSchedulerSettings(), ...(partial.scheduler ?? {}) },
  };
}
