import Dexie, { type EntityTable } from 'dexie';
import type { Verse, Collection, VerseProgress, UserProfile } from '../../types';

export class BibleMemoryDB extends Dexie {
  verses!: EntityTable<Verse, 'id'>;
  collections!: EntityTable<Collection, 'id'>;
  progress!: EntityTable<VerseProgress, 'verseId'>;
  profile!: EntityTable<UserProfile, 'id'>;

  constructor() {
    super('bible-memory');
    this.version(1).stores({
      verses: 'id, collectionId, order',
      collections: 'id, order',
      progress: 'verseId, nextReviewDate, status',
      profile: 'id',
    });
    // v2: verses no longer belong to a single "home" collection (topic collections were
    // dropped in favor of one flat Set concept) — membership lives entirely in
    // Collection.verseIds now, so the collectionId index is gone.
    this.version(2).stores({
      verses: 'id, createdAt',
      collections: 'id, order',
      progress: 'verseId, nextReviewDate, status',
      profile: 'id',
    });
  }
}

export const db = new BibleMemoryDB();
