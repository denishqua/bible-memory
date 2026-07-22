import { createContext } from "react";
import type { StorageAdapter } from "../types/storage";
import { LocalStorageAdapter } from "./localStorageAdapter";
import { ChromeStorageAdapter } from "./chromeStorageAdapter";

function isChromeStorageAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    !!chrome.storage &&
    !!chrome.storage.local
  );
}

export const defaultAdapter: StorageAdapter = isChromeStorageAvailable()
  ? new ChromeStorageAdapter()
  : new LocalStorageAdapter();

export const StorageContext = createContext<StorageAdapter>(defaultAdapter);
