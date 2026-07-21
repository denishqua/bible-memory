import type { StorageAdapter } from "../types/storage";
import type { Verse } from "../types/verse";
import type { Collection, CollectionVerseLink } from "../types/collection";
import type { ReviewSession } from "../types/review";
import { normalizeProfile, type Profile } from "../types/profile";
import { defaultSettings, mergeSettings, type Settings } from "../types/settings";

export const STORAGE_KEYS = {
  verses: "bm.verses.v1",
  collections: "bm.collections.v1",
  collectionLinks: "bm.collectionLinks.v1",
  reviewSessions: "bm.reviewSessions.v1",
  profile: "bm.profile.v1",
  settings: "bm.settings.v1",
  gateCooldown: "bm.gateCooldown.v1",
} as const;

export const THEME_KEY = "bm.theme.v1";

export interface StorageDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  clearAllKeys(): Promise<void>;
}

export abstract class BaseStorageAdapter implements StorageAdapter {
  protected driver: StorageDriver;

  constructor(driver: StorageDriver) {
    this.driver = driver;
  }

  protected async getArray<T>(key: string): Promise<T[]> {
    const data = await this.driver.get<T[]>(key);
    return Array.isArray(data) ? data : [];
  }

  protected async setArray<T>(key: string, value: T[]): Promise<void> {
    await this.driver.set(key, value);
  }

  async getVerses(): Promise<Verse[]> {
    return this.getArray<Verse>(STORAGE_KEYS.verses);
  }

  async saveVerse(v: Verse): Promise<void> {
    const verses = await this.getVerses();
    const index = verses.findIndex((existing) => existing.id === v.id);
    if (index === -1) {
      verses.push(v);
    } else {
      verses[index] = v;
    }
    await this.setArray(STORAGE_KEYS.verses, verses);
  }

  async deleteVerse(id: string): Promise<void> {
    const verses = await this.getVerses();
    await this.setArray(
      STORAGE_KEYS.verses,
      verses.filter((v) => v.id !== id)
    );
    const links = await this.getArray<CollectionVerseLink>(STORAGE_KEYS.collectionLinks);
    await this.setArray(
      STORAGE_KEYS.collectionLinks,
      links.filter((l) => l.verseId !== id)
    );
  }

  async getCollections(): Promise<Collection[]> {
    return this.getArray<Collection>(STORAGE_KEYS.collections);
  }

  async saveCollection(c: Collection): Promise<void> {
    const collections = await this.getCollections();
    const index = collections.findIndex((existing) => existing.id === c.id);
    if (index === -1) {
      collections.push(c);
    } else {
      collections[index] = c;
    }
    await this.setArray(STORAGE_KEYS.collections, collections);
  }

  async deleteCollection(id: string): Promise<void> {
    const collections = await this.getCollections();
    await this.setArray(
      STORAGE_KEYS.collections,
      collections.filter((c) => c.id !== id)
    );
    const links = await this.getArray<CollectionVerseLink>(STORAGE_KEYS.collectionLinks);
    await this.setArray(
      STORAGE_KEYS.collectionLinks,
      links.filter((l) => l.collectionId !== id)
    );
  }

  async getCollectionLinks(): Promise<CollectionVerseLink[]> {
    return this.getArray<CollectionVerseLink>(STORAGE_KEYS.collectionLinks);
  }

  async addVerseToCollection(link: CollectionVerseLink): Promise<void> {
    const links = await this.getCollectionLinks();
    const exists = links.some(
      (l) => l.collectionId === link.collectionId && l.verseId === link.verseId
    );
    if (exists) return;

    links.push({ ...link });
    await this.setArray(STORAGE_KEYS.collectionLinks, links);
  }

  async removeVerseFromCollection(collectionId: string, verseId: string): Promise<void> {
    const links = await this.getCollectionLinks();
    await this.setArray(
      STORAGE_KEYS.collectionLinks,
      links.filter((l) => !(l.collectionId === collectionId && l.verseId === verseId))
    );
  }

  async reorderCollectionVerses(collectionId: string, orderedVerseIds: string[]): Promise<void> {
    const links = await this.getCollectionLinks();
    const existingMap = new Map(
      links.filter((l) => l.collectionId === collectionId).map((l) => [l.verseId, l])
    );
    const otherLinks = links.filter((l) => l.collectionId !== collectionId);
    const updatedCollectionLinks: CollectionVerseLink[] = orderedVerseIds.map((verseId, index) => {
      const existing = existingMap.get(verseId);
      return {
        collectionId,
        verseId,
        addedAt: existing?.addedAt ?? new Date().toISOString(),
        sortOrder: index,
      };
    });
    await this.setArray(STORAGE_KEYS.collectionLinks, [...otherLinks, ...updatedCollectionLinks]);
  }

  async getReviewSessions(): Promise<ReviewSession[]> {
    return this.getArray<ReviewSession>(STORAGE_KEYS.reviewSessions);
  }

  async appendReviewSession(s: ReviewSession): Promise<void> {
    const sessions = await this.getReviewSessions();
    const index = sessions.findIndex((existing) => existing.id === s.id);
    if (index === -1) {
      sessions.push(s);
    } else {
      sessions[index] = s;
    }
    await this.setArray(STORAGE_KEYS.reviewSessions, sessions);
  }

  async touchGateReview(): Promise<void> {
    await this.driver.set(STORAGE_KEYS.gateCooldown, Date.now());
  }

  async recordLiveReview(session: ReviewSession): Promise<void> {
    await this.appendReviewSession(session);
    await this.touchGateReview();
  }

  async getProfile(): Promise<Profile> {
    const raw = await this.driver.get<unknown>(STORAGE_KEYS.profile);
    const sessions = await this.getReviewSessions();
    const profile = normalizeProfile(raw);
    const rawObj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    if (rawObj.versesPracticed === undefined && sessions.length > 0) {
      profile.versesPracticed = sessions.length;
    }
    await this.driver.set(STORAGE_KEYS.profile, profile);
    return profile;
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.driver.set(STORAGE_KEYS.profile, profile);
  }

  async getSettings(): Promise<Settings> {
    const raw = await this.driver.get<unknown>(STORAGE_KEYS.settings);
    if (!raw || typeof raw !== "object") {
      const defaults = defaultSettings();
      await this.driver.set(STORAGE_KEYS.settings, defaults);
      return defaults;
    }
    return mergeSettings(raw as Partial<Settings>);
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.driver.set(STORAGE_KEYS.settings, settings);
  }

  async clearAll(): Promise<void> {
    await this.driver.clearAllKeys();
  }
}
