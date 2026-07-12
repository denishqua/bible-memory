import type { VerseStore, CollectionStore, ProgressStore, ProfileStore } from './types';
import { LocalVerseStore } from './local/localVerseStore';
import { LocalCollectionStore } from './local/localCollectionStore';
import { LocalProgressStore } from './local/localProgressStore';
import { LocalProfileStore } from './local/localProfileStore';

export const verseStore: VerseStore = new LocalVerseStore();
export const collectionStore: CollectionStore = new LocalCollectionStore();
export const progressStore: ProgressStore = new LocalProgressStore();
export const profileStore: ProfileStore = new LocalProfileStore();

export { db } from './local/db';
export { LOCAL_PROFILE_ID } from './local/localProfileStore';
