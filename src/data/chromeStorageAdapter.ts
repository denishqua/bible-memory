import { BaseStorageAdapter, STORAGE_KEYS, THEME_KEY, type StorageDriver } from "./BaseStorageAdapter";

class ChromeStorageDriver implements StorageDriver {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async clearAllKeys(): Promise<void> {
    const allKeys = [...Object.values(STORAGE_KEYS), THEME_KEY];
    await chrome.storage.local.remove(allKeys);
    localStorage.removeItem(THEME_KEY);
  }
}

export class ChromeStorageAdapter extends BaseStorageAdapter {
  constructor() {
    super(new ChromeStorageDriver());
  }
}
