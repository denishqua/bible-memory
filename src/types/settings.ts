import type { ReviewMode } from "./review";

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
  // ISO timestamp; gate is disabled until this instant. null = not snoozed.
  snoozeUntil: string | null;
  // Verse pool: a collection, optionally narrowed to a subset of its verses.
  // collectionId null = unconfigured — the gate FAILS OPEN (never blocks).
  collectionId: string | null;
  // null = the whole collection; otherwise the selected subset.
  verseIds: string[] | null;
  // The single review mode used by the gate (verses are random, mode is not).
  mode: ReviewMode;
}

export function defaultNewTabGateSettings(): NewTabGateSettings {
  return {
    enabled: false,
    whitelist: [],
    snoozeUntil: null,
    collectionId: null,
    verseIds: null,
    mode: "type-it",
  };
}

// App-level user settings, persisted as a single object under `bm.settings.v1`
// so future fields can be added without new storage keys.
export interface Settings {
  // ESV API token entered by the user at runtime. Empty string means "no key",
  // in which case ESV lookup is unavailable (manual verse entry still works).
  // There is no bundled/built-in key — each user supplies their own.
  esvApiKey: string;
  newTabGate: NewTabGateSettings;
}

export function defaultSettings(): Settings {
  return { esvApiKey: "", newTabGate: defaultNewTabGateSettings() };
}
