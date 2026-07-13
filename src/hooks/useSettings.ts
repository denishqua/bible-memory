import { useCallback, useEffect, useState } from "react";
import { useStorage } from "../data/storageContext";
import type { Settings } from "../types/settings";

// Mirrors useProfile: multiple components can mount their own useSettings()
// instance (the Settings page, AddVerseForm's ESV lookup, …) with no shared
// store. Whoever calls updateSettings() broadcasts this window event, and
// every mounted useSettings() instance re-fetches from storage.
export const SETTINGS_UPDATED_EVENT = "bm:settings-updated";

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
