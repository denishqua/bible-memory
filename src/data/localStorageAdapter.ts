import type { StorageAdapter } from "../types/storage";
import type { Verse } from "../types/verse";
import type { Collection, CollectionVerseLink } from "../types/collection";
import type { ReviewSession } from "../types/review";
import { normalizeProfile, type Profile } from "../types/profile";
import { defaultSettings, mergeSettings, type Settings } from "../types/settings";

const KEYS = {
  verses: "bm.verses.v1",
  collections: "bm.collections.v1",
  collectionLinks: "bm.collectionLinks.v1",
  reviewSessions: "bm.reviewSessions.v1",
  profile: "bm.profile.v1",
  settings: "bm.settings.v1",
  // Runtime state (not user config): epoch ms of the last completed verse
  // review, used by the verse gate's cooldown. (Only the Chrome extension
  // enforces the gate, but the web app writes this too so the flow is testable
  // in plain `npm run dev`.)
  gateCooldown: "bm.gateCooldown.v1",
} as const;

// Theme is intentionally NOT part of the Settings object — useTheme reads it
// synchronously from localStorage on first paint to avoid a flash of the
// wrong theme. clearAll still needs to know about it.
const THEME_KEY = "bm.theme.v1";

function readArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultProfile(): Profile {
  return {
    createdAt: new Date().toISOString(),
    versesPracticed: 0,
  };
}

export class LocalStorageAdapter implements StorageAdapter {
  async getVerses(): Promise<Verse[]> {
    return readArray<Verse>(KEYS.verses);
  }

  async saveVerse(v: Verse): Promise<void> {
    const verses = readArray<Verse>(KEYS.verses);
    const index = verses.findIndex((existing) => existing.id === v.id);
    if (index === -1) {
      verses.push(v);
    } else {
      verses[index] = v;
    }
    writeArray(KEYS.verses, verses);
  }

  async deleteVerse(id: string): Promise<void> {
    const verses = readArray<Verse>(KEYS.verses);
    writeArray(
      KEYS.verses,
      verses.filter((v) => v.id !== id),
    );
    // Mirrors the deleteCollection fix: a deleted verse must not leave
    // orphaned CollectionVerseLink rows behind (they'd silently inflate
    // collection verse counts forever).
    const links = readArray<CollectionVerseLink>(KEYS.collectionLinks);
    writeArray(
      KEYS.collectionLinks,
      links.filter((link) => link.verseId !== id),
    );
  }

  async getCollections(): Promise<Collection[]> {
    return readArray<Collection>(KEYS.collections);
  }

  async saveCollection(c: Collection): Promise<void> {
    const collections = readArray<Collection>(KEYS.collections);
    const index = collections.findIndex((existing) => existing.id === c.id);
    if (index === -1) {
      collections.push(c);
    } else {
      collections[index] = c;
    }
    writeArray(KEYS.collections, collections);
  }

  async deleteCollection(id: string): Promise<void> {
    const collections = readArray<Collection>(KEYS.collections);
    writeArray(
      KEYS.collections,
      collections.filter((c) => c.id !== id),
    );
    // Spec-review fix #6: deleting a collection must also purge every
    // CollectionVerseLink referencing it — otherwise stale links accumulate.
    const links = readArray<CollectionVerseLink>(KEYS.collectionLinks);
    writeArray(
      KEYS.collectionLinks,
      links.filter((link) => link.collectionId !== id),
    );
  }

  async getCollectionLinks(): Promise<CollectionVerseLink[]> {
    return readArray<CollectionVerseLink>(KEYS.collectionLinks);
  }

  async addVerseToCollection(link: CollectionVerseLink): Promise<void> {
    const links = readArray<CollectionVerseLink>(KEYS.collectionLinks);
    const alreadyLinked = links.some(
      (existing) =>
        existing.collectionId === link.collectionId && existing.verseId === link.verseId,
    );
    if (!alreadyLinked) {
      links.push(link);
      writeArray(KEYS.collectionLinks, links);
    }
  }

  async removeVerseFromCollection(collectionId: string, verseId: string): Promise<void> {
    const links = readArray<CollectionVerseLink>(KEYS.collectionLinks);
    writeArray(
      KEYS.collectionLinks,
      links.filter((link) => !(link.collectionId === collectionId && link.verseId === verseId)),
    );
  }

  async reorderCollectionVerses(collectionId: string, orderedVerseIds: string[]): Promise<void> {
    const links = readArray<CollectionVerseLink>(KEYS.collectionLinks);
    const orderByVerseId = new Map(orderedVerseIds.map((verseId, index) => [verseId, index]));
    const next = links.map((link) => {
      if (link.collectionId !== collectionId) return link;
      const sortOrder = orderByVerseId.get(link.verseId);
      if (sortOrder === undefined) return link;
      return { ...link, sortOrder };
    });
    writeArray(KEYS.collectionLinks, next);
  }

  async getReviewSessions(): Promise<ReviewSession[]> {
    return readArray<ReviewSession>(KEYS.reviewSessions);
  }

  async appendReviewSession(s: ReviewSession): Promise<void> {
    const sessions = readArray<ReviewSession>(KEYS.reviewSessions);
    sessions.push(s);
    writeArray(KEYS.reviewSessions, sessions);
  }

  async recordLiveReview(s: ReviewSession): Promise<void> {
    await this.appendReviewSession(s);
    await this.touchGateReview();
  }

  async getProfile(): Promise<Profile> {
    const raw = localStorage.getItem(KEYS.profile);
    if (!raw) {
      const profile = defaultProfile();
      localStorage.setItem(KEYS.profile, JSON.stringify(profile));
      return profile;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      // Migration for returning users: a streak-era profile has no numeric
      // `versesPracticed`, so seed it from the existing review-history count
      // rather than resetting past practice to 0. A profile that already
      // carries a numeric count is normalized as-is (never reseeded).
      const hasCount =
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as Record<string, unknown>).versesPracticed === "number";
      const profile = normalizeProfile(parsed);
      if (!hasCount) {
        profile.versesPracticed = (await this.getReviewSessions()).length;
      }
      return profile;
    } catch {
      const profile = defaultProfile();
      localStorage.setItem(KEYS.profile, JSON.stringify(profile));
      return profile;
    }
  }

  async saveProfile(p: Profile): Promise<void> {
    localStorage.setItem(KEYS.profile, JSON.stringify(p));
  }

  async getSettings(): Promise<Settings> {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) {
      const settings = defaultSettings();
      localStorage.setItem(KEYS.settings, JSON.stringify(settings));
      return settings;
    }
    try {
      // Merge over defaults so settings saved before a new field existed
      // (e.g. `newTabGate`, or a new field inside it) still come back fully
      // populated.
      return mergeSettings(JSON.parse(raw) as Partial<Settings>);
    } catch {
      const settings = defaultSettings();
      localStorage.setItem(KEYS.settings, JSON.stringify(settings));
      return settings;
    }
  }

  async saveSettings(s: Settings): Promise<void> {
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
  }

  async touchGateReview(): Promise<void> {
    localStorage.setItem(KEYS.gateCooldown, JSON.stringify(Date.now()));
  }

  async clearAll(): Promise<void> {
    for (const key of Object.values(KEYS)) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(THEME_KEY);
  }
}
