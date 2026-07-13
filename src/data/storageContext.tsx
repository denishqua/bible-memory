import { createContext, useContext, type ReactNode } from "react";
import type { StorageAdapter } from "../types/storage";
import { LocalStorageAdapter } from "./localStorageAdapter";
import { ChromeStorageAdapter } from "./chromeStorageAdapter";

// When running as an unpacked Chrome extension, `chrome.storage.local` is
// available and is the durable, per-extension store to use. Everywhere else
// (plain `npm run dev` / `npm run preview` in a normal browser tab) it's
// undefined, so we fall back to the original localStorage-backed adapter —
// this keeps normal web development working unmodified.
function isChromeStorageAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    !!chrome.storage &&
    !!chrome.storage.local
  );
}

const defaultAdapter: StorageAdapter = isChromeStorageAvailable()
  ? new ChromeStorageAdapter()
  : new LocalStorageAdapter();

const StorageContext = createContext<StorageAdapter>(defaultAdapter);

export function StorageProvider({
  adapter = defaultAdapter,
  children,
}: {
  adapter?: StorageAdapter;
  children: ReactNode;
}) {
  return <StorageContext.Provider value={adapter}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageAdapter {
  return useContext(StorageContext);
}
