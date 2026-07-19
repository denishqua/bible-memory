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
      expect(profile.versesPracticed).toBe(0);
    });

    it("saves and retrieves an updated profile", async () => {
      const profile = await adapter.getProfile();
      const updated = { ...profile, versesPracticed: 7 };
      await adapter.saveProfile(updated);

      const retrieved = await adapter.getProfile();
      expect(retrieved.versesPracticed).toBe(7);
    });

    it("migrates an old streak-era profile by seeding versesPracticed from review history", async () => {
      // A pre-versesPracticed profile: it has createdAt + streak, no count.
      localStorage.setItem(
        "bm.profile.v1",
        JSON.stringify({
          createdAt: "2026-01-01T00:00:00.000Z",
          streak: { currentStreak: 3, longestStreak: 5, lastQualifyingDate: "2026-07-12" },
        }),
      );
      // Two logged sessions in history → the migrated count seeds from that.
      const now = new Date().toISOString();
      for (const id of ["s1", "s2"]) {
        await adapter.appendReviewSession({
          id,
          scope: { type: "verse", verseId: "v1" },
          mode: "type-it",
          result: {
            type: "accuracy",
            accuracy: 100,
            passed: true,
            totalKeystrokes: 5,
            correctKeystrokes: 5,
          },
          startedAt: now,
          completedAt: now,
        });
      }

      const migrated = await adapter.getProfile();
      expect(migrated.versesPracticed).toBe(2);
      expect(migrated.createdAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("migrates an old streak-era profile to 0 when there is no review history", async () => {
      localStorage.setItem(
        "bm.profile.v1",
        JSON.stringify({
          createdAt: "2026-01-01T00:00:00.000Z",
          streak: { currentStreak: 0, longestStreak: 0, lastQualifyingDate: null },
        }),
      );

      const migrated = await adapter.getProfile();
      expect(migrated.versesPracticed).toBe(0);
    });

    it("does not reseed a profile that already has a numeric versesPracticed", async () => {
      localStorage.setItem(
        "bm.profile.v1",
        JSON.stringify({ createdAt: "2026-01-01T00:00:00.000Z", versesPracticed: 4 }),
      );
      // History exists, but an already-migrated profile must NOT be reseeded.
      const now = new Date().toISOString();
      await adapter.appendReviewSession({
        id: "s1",
        scope: { type: "verse", verseId: "v1" },
        mode: "type-it",
        result: {
          type: "accuracy",
          accuracy: 100,
          passed: true,
          totalKeystrokes: 5,
          correctKeystrokes: 5,
        },
        startedAt: now,
        completedAt: now,
      });

      const profile = await adapter.getProfile();
      expect(profile.versesPracticed).toBe(4);
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

    it("deep-merges a partial newTabGate block so newly-added nested fields get defaults", async () => {
      // Simulate a gate block saved before some nested fields existed.
      localStorage.setItem(
        "bm.settings.v1",
        JSON.stringify({
          esvApiKey: "old-key",
          newTabGate: { enabled: true, whitelist: ["example.com"] },
        }),
      );

      const settings = await adapter.getSettings();
      expect(settings.newTabGate).toEqual({
        ...defaultNewTabGateSettings(),
        enabled: true,
        whitelist: ["example.com"],
      });
    });

    it("falls back to defaults on corrupt stored JSON", async () => {
      localStorage.setItem("bm.settings.v1", "{not json");
      const settings = await adapter.getSettings();
      expect(settings).toEqual(defaultSettings());
    });
  });

  describe("gate cooldown", () => {
    it("touchGateReview stamps the current time (epoch ms) under its own key", async () => {
      const before = Date.now();
      await adapter.touchGateReview();
      const after = Date.now();

      const raw = localStorage.getItem("bm.gateCooldown.v1");
      expect(raw).not.toBeNull();
      const stamped = JSON.parse(raw as string) as number;
      expect(typeof stamped).toBe("number");
      expect(stamped).toBeGreaterThanOrEqual(before);
      expect(stamped).toBeLessThanOrEqual(after);
    });

    it("does not touch the settings blob (cooldown state is stored separately)", async () => {
      await adapter.getSettings(); // seed defaults
      const settingsBefore = localStorage.getItem("bm.settings.v1");
      await adapter.touchGateReview();
      expect(localStorage.getItem("bm.settings.v1")).toBe(settingsBefore);
    });

    it("clearAll removes the cooldown timestamp", async () => {
      await adapter.touchGateReview();
      expect(localStorage.getItem("bm.gateCooldown.v1")).not.toBeNull();
      await adapter.clearAll();
      expect(localStorage.getItem("bm.gateCooldown.v1")).toBeNull();
    });

    it("recordLiveReview both appends the record and stamps the cooldown", async () => {
      const now = new Date().toISOString();
      await adapter.recordLiveReview({
        id: "live1",
        scope: { type: "verse", verseId: "v1" },
        mode: "type-it",
        result: {
          type: "accuracy",
          accuracy: 100,
          passed: true,
          totalKeystrokes: 5,
          correctKeystrokes: 5,
        },
        startedAt: now,
        completedAt: now,
      });

      const sessions = await adapter.getReviewSessions();
      expect(sessions.map((s) => s.id)).toContain("live1");
      expect(localStorage.getItem("bm.gateCooldown.v1")).not.toBeNull();
    });

    it("appendReviewSession appends WITHOUT stamping (import must not reset the cooldown)", async () => {
      const now = new Date().toISOString();
      await adapter.appendReviewSession({
        id: "import1",
        scope: { type: "verse", verseId: "v1" },
        mode: "type-it",
        result: {
          type: "accuracy",
          accuracy: 100,
          passed: true,
          totalKeystrokes: 5,
          correctKeystrokes: 5,
        },
        startedAt: now,
        completedAt: now,
      });

      const sessions = await adapter.getReviewSessions();
      expect(sessions.map((s) => s.id)).toContain("import1");
      expect(localStorage.getItem("bm.gateCooldown.v1")).toBeNull();
    });
  });
});
