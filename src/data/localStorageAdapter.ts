import type { StorageAdapter } from "../types/storage";
import type { Verse } from "../types/verse";
import type { Collection, CollectionVerseLink } from "../types/collection";
import type { ReviewSession } from "../types/review";
import type { Profile } from "../types/profile";

const KEYS = {
  verses: "bm.verses.v1",
  collections: "bm.collections.v1",
  collectionLinks: "bm.collectionLinks.v1",
  reviewSessions: "bm.reviewSessions.v1",
  profile: "bm.profile.v1",
} as const;

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
    streak: {
      currentStreak: 0,
      longestStreak: 0,
      lastQualifyingDate: null,
    },
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

  async getReviewSessions(): Promise<ReviewSession[]> {
    return readArray<ReviewSession>(KEYS.reviewSessions);
  }

  async appendReviewSession(s: ReviewSession): Promise<void> {
    const sessions = readArray<ReviewSession>(KEYS.reviewSessions);
    sessions.push(s);
    writeArray(KEYS.reviewSessions, sessions);
  }

  async getProfile(): Promise<Profile> {
    const raw = localStorage.getItem(KEYS.profile);
    if (!raw) {
      const profile = defaultProfile();
      localStorage.setItem(KEYS.profile, JSON.stringify(profile));
      return profile;
    }
    try {
      return JSON.parse(raw) as Profile;
    } catch {
      const profile = defaultProfile();
      localStorage.setItem(KEYS.profile, JSON.stringify(profile));
      return profile;
    }
  }

  async saveProfile(p: Profile): Promise<void> {
    localStorage.setItem(KEYS.profile, JSON.stringify(p));
  }
}
