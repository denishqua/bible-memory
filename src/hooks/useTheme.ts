import { useCallback, useEffect, useState } from "react";
import { THEME_KEY } from "../data/BaseStorageAdapter";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function resolveSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? resolveSystemTheme() : preference;
}

function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", resolved);
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  cycleTheme: () => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(preference));

  useEffect(() => {
    applyTheme(preference);
    setResolved(resolveTheme(preference));

    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyTheme("system");
      setResolved(resolveTheme("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(THEME_KEY, next);
    setPreferenceState(next);
  }, []);

  // A simple light/dark toggle: whichever theme is currently showing, flip to
  // the other one and persist that as the explicit choice. "system" is only
  // ever the implicit starting point (before any explicit choice), never a
  // state the toggle cycles back into.
  const cycleTheme = useCallback(() => {
    setPreference(resolved === "light" ? "dark" : "light");
  }, [resolved, setPreference]);

  return { preference, resolved, setPreference, cycleTheme };
}
