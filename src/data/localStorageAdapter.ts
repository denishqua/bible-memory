import { BaseStorageAdapter, STORAGE_KEYS, THEME_KEY, type StorageDriver } from "./BaseStorageAdapter";

class LocalStorageDriver implements StorageDriver {
  async get<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async clearAllKeys(): Promise<void> {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(THEME_KEY);
  }
}

export class LocalStorageAdapter extends BaseStorageAdapter {
  constructor() {
    super(new LocalStorageDriver());
  }
}
