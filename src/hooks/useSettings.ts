import { useCallback, useEffect, useState } from "react";
import { useStorage } from "./useStorage";
import type { Settings } from "../types/settings";

// Mirrors useProfile: multiple components can mount their own useSettings()
// instance (the Settings page, AddVerseForm's ESV lookup, …) with no shared
// store. Whoever calls updateSettings() broadcasts this window event, and
// every mounted useSettings() instance re-fetches from storage.
export const SETTINGS_UPDATED_EVENT = "bm:settings-updated";

// Storage key the settings blob lives under (KEYS.settings in the adapters).
const SETTINGS_STORAGE_KEY = "bm.settings.v1";

export function useSettings() {
  const storage = useStorage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await storage.getSettings();
    setSettings(next);
    setLoading(false);
  }, [storage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleExternalUpdate = () => {
      refresh();
    };
    window.addEventListener(SETTINGS_UPDATED_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, handleExternalUpdate);
  }, [refresh]);

  // Extension only: the background service worker writes the settings key
  // directly (e.g. the context-menu "Whitelist this domain"), which never
  // fires the window event above. Without this, an open Settings page keeps
  // stale state and the next gate edit spreads it back over storage,
  // clobbering the just-added domain. No-op in the plain web app.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (SETTINGS_STORAGE_KEY in changes) refresh();
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [refresh]);

  const updateSettings = useCallback(
    async (next: Settings): Promise<void> => {
      await storage.saveSettings(next);
      setSettings(next);
      window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
    },
    [storage],
  );

  return { settings, loading, updateSettings, refresh };
}
