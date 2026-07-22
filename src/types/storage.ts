import type { Verse } from "./verse";
import type { Collection, CollectionVerseLink } from "./collection";
import type { ReviewSession } from "./review";
import type { Profile } from "./profile";
import type { Settings } from "./settings";

export interface StorageAdapter {
  getVerses(): Promise<Verse[]>;
  saveVerse(v: Verse): Promise<void>;
  deleteVerse(id: string): Promise<void>;
  getCollections(): Promise<Collection[]>;
  saveCollection(c: Collection): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  getCollectionLinks(): Promise<CollectionVerseLink[]>;
  addVerseToCollection(link: CollectionVerseLink): Promise<void>;
  removeVerseFromCollection(collectionId: string, verseId: string): Promise<void>;

  getReviewSessions(): Promise<ReviewSession[]>;
  // Appends a review record to history. The backup-import path also calls this
  // (per imported record), so it deliberately does NOT touch the gate cooldown
  // — importing old history must not reset the browsing cooldown to now.
  appendReviewSession(s: ReviewSession): Promise<void>;
  // A LIVE review completion (the gate, review sessions, games): logs the
  // record AND stamps the gate cooldown. This is the single choke point for
  // "the user just finished reviewing" — use it instead of calling
  // appendReviewSession + touchGateReview by hand. Import stays on the bare
  // appendReviewSession so it can't reset the cooldown.
  recordLiveReview(s: ReviewSession): Promise<void>;
  getProfile(): Promise<Profile>;
  saveProfile(p: Profile): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  // Stamps "a verse review was just completed" (epoch ms) for the verse gate's
  // cooldown, under its own storage key. Prefer recordLiveReview for review
  // completions that also produce a history record; call this directly only
  // when there is no record to append (e.g. the gate page revealing Proceed).
  // The extension's background worker reads this key directly to decide whether
  // the cooldown window is still open.
  touchGateReview(): Promise<void>;
  // Removes every piece of app data this adapter owns (all `bm.*` keys,
  // including theme + settings). Used by Settings → "Clear all data".
  clearAll(): Promise<void>;
}
