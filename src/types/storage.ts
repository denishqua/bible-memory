import type { Verse } from "./verse";
import type { Collection, CollectionVerseLink } from "./collection";
import type { ReviewSession } from "./review";
import type { Profile } from "./profile";

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
  appendReviewSession(s: ReviewSession): Promise<void>;
  getProfile(): Promise<Profile>;
  saveProfile(p: Profile): Promise<void>;
}
