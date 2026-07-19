import type { StorageAdapter } from "../types/storage";
import type { Verse } from "../types/verse";
import type { Collection, CollectionVerseLink } from "../types/collection";
import type { ReviewSession } from "../types/review";
import { normalizeProfile, type Profile } from "../types/profile";
import { defaultSettings, mergeSettings, type Settings } from "../types/settings";

// Same key names as localStorageAdapter.ts on purpose — a user's existing
// localStorage data could be migrated later by simply copying these keys
// verbatim into chrome.storage.local.
const KEYS = {
  verses: "bm.verses.v1",
  collections: "bm.collections.v1",
  collectionLinks: "bm.collectionLinks.v1",
  reviewSessions: "bm.reviewSessions.v1",
  profile: "bm.profile.v1",
  settings: "bm.settings.v1",
  // Runtime state (not user config): epoch ms of the last completed verse
  // review, read by the background worker to enforce the gate's cooldown. The
  // worker hardcodes this same string (it cannot import) — keep in sync.
  gateCooldown: "bm.gateCooldown.v1",
} as const;

// Theme lives in localStorage even inside the extension (useTheme reads it
// synchronously on first paint to avoid a flash of the wrong theme), so
// clearAll clears it from localStorage here too.
const THEME_KEY = "bm.theme.v1";

async function readArray<T>(key: string): Promise<T[]> {
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

async function writeArray<T>(key: string, value: T[]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

function defaultProfile(): Profile {
  return {
    createdAt: new Date().toISOString(),
    versesPracticed: 0,
  };
}

export class ChromeStorageAdapter implements StorageAdapter {
  async getVerses(): Promise<Verse[]> {
    return readArray<Verse>(KEYS.verses);
  }

  async saveVerse(v: Verse): Promise<void> {
    const verses = await readArray<Verse>(KEYS.verses);
    const index = verses.findIndex((existing) => existing.id === v.id);
    if (index === -1) {
      verses.push(v);
    } else {
      verses[index] = v;
    }
    await writeArray(KEYS.verses, verses);
  }

  async deleteVerse(id: string): Promise<void> {
    const verses = await readArray<Verse>(KEYS.verses);
    await writeArray(
      KEYS.verses,
      verses.filter((v) => v.id !== id),
    );
    // Mirrors the deleteCollection fix: a deleted verse must not leave
    // orphaned CollectionVerseLink rows behind (they'd silently inflate
    // collection verse counts forever).
    const links = await readArray<CollectionVerseLink>(KEYS.collectionLinks);
    await writeArray(
      KEYS.collectionLinks,
      links.filter((link) => link.verseId !== id),
    );
  }

  async getCollections(): Promise<Collection[]> {
    return readArray<Collection>(KEYS.collections);
  }

  async saveCollection(c: Collection): Promise<void> {
    const collections = await readArray<Collection>(KEYS.collections);
    const index = collections.findIndex((existing) => existing.id === c.id);
    if (index === -1) {
      collections.push(c);
    } else {
      collections[index] = c;
    }
    await writeArray(KEYS.collections, collections);
  }

  async deleteCollection(id: string): Promise<void> {
    const collections = await readArray<Collection>(KEYS.collections);
    await writeArray(
      KEYS.collections,
      collections.filter((c) => c.id !== id),
    );
    // Spec-review fix #6: deleting a collection must also purge every
    // CollectionVerseLink referencing it — otherwise stale links accumulate.
    const links = await readArray<CollectionVerseLink>(KEYS.collectionLinks);
    await writeArray(
      KEYS.collectionLinks,
      links.filter((link) => link.collectionId !== id),
    );
  }

  async getCollectionLinks(): Promise<CollectionVerseLink[]> {
    return readArray<CollectionVerseLink>(KEYS.collectionLinks);
  }

  async addVerseToCollection(link: CollectionVerseLink): Promise<void> {
    const links = await readArray<CollectionVerseLink>(KEYS.collectionLinks);
    const alreadyLinked = links.some(
      (existing) =>
        existing.collectionId === link.collectionId && existing.verseId === link.verseId,
    );
    if (!alreadyLinked) {
      links.push(link);
      await writeArray(KEYS.collectionLinks, links);
    }
  }

  async removeVerseFromCollection(collectionId: string, verseId: string): Promise<void> {
    const links = await readArray<CollectionVerseLink>(KEYS.collectionLinks);
    await writeArray(
      KEYS.collectionLinks,
      links.filter((link) => !(link.collectionId === collectionId && link.verseId === verseId)),
    );
  }

  async reorderCollectionVerses(collectionId: string, orderedVerseIds: string[]): Promise<void> {
    const links = await readArray<CollectionVerseLink>(KEYS.collectionLinks);
    const orderByVerseId = new Map(orderedVerseIds.map((verseId, index) => [verseId, index]));
    const next = links.map((link) => {
      if (link.collectionId !== collectionId) return link;
      const sortOrder = orderByVerseId.get(link.verseId);
      if (sortOrder === undefined) return link;
      return { ...link, sortOrder };
    });
    await writeArray(KEYS.collectionLinks, next);
  }

  async getReviewSessions(): Promise<ReviewSession[]> {
    return readArray<ReviewSession>(KEYS.reviewSessions);
  }

  async appendReviewSession(s: ReviewSession): Promise<void> {
    const sessions = await readArray<ReviewSession>(KEYS.reviewSessions);
    sessions.push(s);
    await writeArray(KEYS.reviewSessions, sessions);
  }

  async recordLiveReview(s: ReviewSession): Promise<void> {
    await this.appendReviewSession(s);
    await this.touchGateReview();
  }

  async getProfile(): Promise<Profile> {
    const result = await chrome.storage.local.get(KEYS.profile);
    const value = result[KEYS.profile];
    if (value) {
      // Migration for returning users: a streak-era profile has no numeric
      // `versesPracticed`, so seed it from the existing review-history count
      // rather than resetting past practice to 0. A profile that already
      // carries a numeric count is normalized as-is (never reseeded).
      const hasCount =
        typeof value === "object" &&
        value !== null &&
        typeof (value as Record<string, unknown>).versesPracticed === "number";
      const profile = normalizeProfile(value);
      if (!hasCount) {
        profile.versesPracticed = (await this.getReviewSessions()).length;
      }
      return profile;
    }
    const profile = defaultProfile();
    await chrome.storage.local.set({ [KEYS.profile]: profile });
    return profile;
  }

  async saveProfile(p: Profile): Promise<void> {
    await chrome.storage.local.set({ [KEYS.profile]: p });
  }

  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get(KEYS.settings);
    const value = result[KEYS.settings];
    if (value) {
      // Merge over defaults so settings saved before a new field existed
      // (e.g. `newTabGate`, or a new field inside it) still come back fully
      // populated.
      return mergeSettings(value as Partial<Settings>);
    }
    const settings = defaultSettings();
    await chrome.storage.local.set({ [KEYS.settings]: settings });
    return settings;
  }

  async saveSettings(s: Settings): Promise<void> {
    await chrome.storage.local.set({ [KEYS.settings]: s });
  }

  async touchGateReview(): Promise<void> {
    await chrome.storage.local.set({ [KEYS.gateCooldown]: Date.now() });
  }

  async clearAll(): Promise<void> {
    await chrome.storage.local.remove(Object.values(KEYS));
    localStorage.removeItem(THEME_KEY);
  }
}
