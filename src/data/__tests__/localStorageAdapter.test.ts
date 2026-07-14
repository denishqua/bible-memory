import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "../localStorageAdapter";
import type { Verse } from "../../types/verse";
import type { Collection } from "../../types/collection";
import { defaultNewTabGateSettings, defaultSettings } from "../../types/settings";

function makeVerse(overrides: Partial<Verse> = {}): Verse {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    reference: overrides.reference ?? "John 3:16",
    text: overrides.text ?? "For God so loved the world...",
    translation: overrides.translation ?? "ESV",
    source: overrides.source ?? "manual",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "Faith",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

describe("LocalStorageAdapter", () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
  });

  describe("verses", () => {
    it("saves and retrieves a verse", async () => {
      const verse = makeVerse();
      await adapter.saveVerse(verse);

      const verses = await adapter.getVerses();
      expect(verses).toHaveLength(1);
      expect(verses[0]).toEqual(verse);
    });

    it("updates a verse in place when saved again with the same id", async () => {
      const verse = makeVerse({ reference: "Psalm 23:1" });
      await adapter.saveVerse(verse);

      const updated = { ...verse, text: "The LORD is my shepherd..." };
      await adapter.saveVerse(updated);

      const verses = await adapter.getVerses();
      expect(verses).toHaveLength(1);
      expect(verses[0].text).toBe("The LORD is my shepherd...");
    });

    it("deletes a verse", async () => {
      const verse = makeVerse();
      await adapter.saveVerse(verse);
      await adapter.deleteVerse(verse.id);

      const verses = await adapter.getVerses();
      expect(verses).toHaveLength(0);
    });
  });

  describe("collections", () => {
    it("saves and retrieves a collection", async () => {
      const collection = makeCollection();
      await adapter.saveCollection(collection);

      const collections = await adapter.getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0]).toEqual(collection);
    });

    it("deletes a collection", async () => {
      const collection = makeCollection();
      await adapter.saveCollection(collection);
      await adapter.deleteCollection(collection.id);

      const collections = await adapter.getCollections();
      expect(collections).toHaveLength(0);
    });
  });

  describe("collection links", () => {
    it("adding the same verse to two collections does not duplicate the verse", async () => {
      const verse = makeVerse();
      const collectionA = makeCollection({ name: "Faith" });
      const collectionB = makeCollection({ name: "Fear & Anxiety" });

      await adapter.saveVerse(verse);
      await adapter.saveCollection(collectionA);
      await adapter.saveCollection(collectionB);

      await adapter.addVerseToCollection({
        collectionId: collectionA.id,
        verseId: verse.id,
        addedAt: new Date().toISOString(),
      });
      await adapter.addVerseToCollection({
        collectionId: collectionB.id,
        verseId: verse.id,
        addedAt: new Date().toISOString(),
      });

      const verses = await adapter.getVerses();
      const links = await adapter.getCollectionLinks();

      expect(verses).toHaveLength(1);
      expect(links).toHaveLength(2);
      expect(links.map((l) => l.collectionId).sort()).toEqual(
        [collectionA.id, collectionB.id].sort(),
      );
    });

    it("removeVerseFromCollection removes only the matching link", async () => {
      const verse = makeVerse();
      const collectionA = makeCollection({ name: "Faith" });
      const collectionB = makeCollection({ name: "Fear & Anxiety" });
      await adapter.saveVerse(verse);
      await adapter.saveCollection(collectionA);
      await adapter.saveCollection(collectionB);
      await adapter.addVerseToCollection({
        collectionId: collectionA.id,
        verseId: verse.id,
        addedAt: new Date().toISOString(),
      });
      await adapter.addVerseToCollection({
        collectionId: collectionB.id,
        verseId: verse.id,
        addedAt: new Date().toISOString(),
      });

      await adapter.removeVerseFromCollection(collectionA.id, verse.id);

      const links = await adapter.getCollectionLinks();
      expect(links).toHaveLength(1);
      expect(links[0].collectionId).toBe(collectionB.id);
    });

    it("deleting a collection removes its links but leaves verses untouched", async () => {
      const verseA = makeVerse({ reference: "John 3:16" });
      const verseB = makeVerse({ reference: "Psalm 23:1" });
      const collectionA = makeCollection({ name: "Faith" });
      const collectionB = makeCollection({ name: "Fear & Anxiety" });

      await adapter.saveVerse(verseA);
      await adapter.saveVerse(verseB);
      await adapter.saveCollection(collectionA);
      await adapter.saveCollection(collectionB);

      await adapter.addVerseToCollection({
        collectionId: collectionA.id,
        verseId: verseA.id,
        addedAt: new Date().toISOString(),
      });
      await adapter.addVerseToCollection({
        collectionId: collectionA.id,
        verseId: verseB.id,
        addedAt: new Date().toISOString(),
      });
      await adapter.addVerseToCollection({
        collectionId: collectionB.id,
        verseId: verseA.id,
        addedAt: new Date().toISOString(),
      });

      await adapter.deleteCollection(collectionA.id);

      const collections = await adapter.getCollections();
      const links = await adapter.getCollectionLinks();
      const verses = await adapter.getVerses();

      expect(collections).toHaveLength(1);
      expect(collections[0].id).toBe(collectionB.id);

      // Only the link to the surviving collection remains.
      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        collectionId: collectionB.id,
        verseId: verseA.id,
        addedAt: links[0].addedAt,
      });

      // Both verses survive collection deletion.
      expect(verses).toHaveLength(2);
      expect(verses.map((v) => v.id).sort()).toEqual([verseA.id, verseB.id].sort());
    });
  });

  describe("profile", () => {
    it("creates a default profile on first access", async () => {
      const profile = await adapter.getProfile();
      expect(profile.streak).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        lastQualifyingDate: null,
      });
    });

    it("saves and retrieves an updated profile", async () => {
      const profile = await adapter.getProfile();
      const updated = {
        ...profile,
        streak: { currentStreak: 3, longestStreak: 5, lastQualifyingDate: "2026-07-12" },
      };
      await adapter.saveProfile(updated);

      const retrieved = await adapter.getProfile();
      expect(retrieved.streak.currentStreak).toBe(3);
      expect(retrieved.streak.lastQualifyingDate).toBe("2026-07-12");
    });
  });

  describe("review sessions", () => {
    it("appends review sessions", async () => {
      const now = new Date().toISOString();
      await adapter.appendReviewSession({
        id: crypto.randomUUID(),
        scope: { type: "verse", verseId: "v1" },
        mode: "master-it",
        result: {
          type: "accuracy",
          accuracy: 95,
          passed: true,
          totalKeystrokes: 20,
          correctKeystrokes: 19,
        },
        startedAt: now,
        completedAt: now,
      });

      const sessions = await adapter.getReviewSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].mode).toBe("master-it");
    });
  });

  describe("settings", () => {
    it("creates and persists defaults on first access", async () => {
      const settings = await adapter.getSettings();
      expect(settings).toEqual(defaultSettings());
      // Persisted, not just returned.
      expect(localStorage.getItem("bm.settings.v1")).not.toBeNull();
    });

    it("round-trips saved settings", async () => {
      const settings = await adapter.getSettings();
      const updated = {
        ...settings,
        esvApiKey: "test-key",
        newTabGate: {
          ...settings.newTabGate,
          enabled: true,
          whitelist: ["example.com"],
        },
      };
      await adapter.saveSettings(updated);

      const retrieved = await adapter.getSettings();
      expect(retrieved).toEqual(updated);
    });

    it("merges stored settings over defaults so an old install missing newTabGate gets the default block", async () => {
      // Simulate a pre-newTabGate install: only esvApiKey was ever saved.
      localStorage.setItem("bm.settings.v1", JSON.stringify({ esvApiKey: "old-key" }));

      const settings = await adapter.getSettings();
      expect(settings.esvApiKey).toBe("old-key");
      expect(settings.newTabGate).toEqual(defaultNewTabGateSettings());
    });

    it("falls back to defaults on corrupt stored JSON", async () => {
      localStorage.setItem("bm.settings.v1", "{not json");
      const settings = await adapter.getSettings();
      expect(settings).toEqual(defaultSettings());
    });
  });
});
