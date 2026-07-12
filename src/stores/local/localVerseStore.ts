import type { Verse } from '../../types';
import type { VerseStore } from '../types';
import { db } from './db';

export class LocalVerseStore implements VerseStore {
  getAllVerses(): Promise<Verse[]> {
    return db.verses.orderBy('order').toArray();
  }

  getVerseById(id: string): Promise<Verse | undefined> {
    return db.verses.get(id);
  }

  getVersesByCollection(collectionId: string): Promise<Verse[]> {
    return db.verses.where('collectionId').equals(collectionId).sortBy('order');
  }

  async addVerse(verse: Verse): Promise<void> {
    await db.verses.add(verse);
  }

  async updateVerse(id: string, patch: Partial<Verse>): Promise<void> {
    await db.verses.update(id, patch);
  }

  async deleteVerse(id: string): Promise<void> {
    await db.verses.delete(id);
  }
}
