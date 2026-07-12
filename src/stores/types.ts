import type { Verse, Collection, VerseProgress, UserProfile } from '../types';

export interface VerseStore {
  getAllVerses(): Promise<Verse[]>;
  getVerseById(id: string): Promise<Verse | undefined>;
  getVersesByCollection(collectionId: string): Promise<Verse[]>;
  addVerse(verse: Verse): Promise<void>;
  updateVerse(id: string, patch: Partial<Verse>): Promise<void>;
  deleteVerse(id: string): Promise<void>;
}

export interface CollectionStore {
  getAllCollections(): Promise<Collection[]>;
  getCollectionById(id: string): Promise<Collection | undefined>;
}

export interface ProgressStore {
  getAllProgress(): Promise<VerseProgress[]>;
  getProgress(verseId: string): Promise<VerseProgress | undefined>;
  getDueForReview(asOfDate: string): Promise<VerseProgress[]>;
  upsertProgress(progress: VerseProgress): Promise<void>;
}

export interface ProfileStore {
  getProfile(): Promise<UserProfile | undefined>;
  updateProfile(patch: Partial<UserProfile>): Promise<void>;
  awardBadge(badgeId: string): Promise<void>;
}
