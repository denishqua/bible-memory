// App-level user settings, persisted as a single object under `bm.settings.v1`
// so future fields can be added without new storage keys.
export interface Settings {
  // ESV API token entered by the user at runtime. Empty string means "no key",
  // in which case ESV lookup is unavailable (manual verse entry still works).
  // There is no bundled/built-in key — each user supplies their own.
  esvApiKey: string;
}

export function defaultSettings(): Settings {
  return { esvApiKey: "" };
}
