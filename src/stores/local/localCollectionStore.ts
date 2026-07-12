import type { Collection } from '../../types';
import type { CollectionStore } from '../types';
import { db } from './db';

export class LocalCollectionStore implements CollectionStore {
  getAllCollections(): Promise<Collection[]> {
    return db.collections.orderBy('order').toArray();
  }

  getCollectionById(id: string): Promise<Collection | undefined> {
    return db.collections.get(id);
  }

  async addCollection(collection: Collection): Promise<void> {
    await db.collections.add(collection);
  }

  async updateCollection(id: string, patch: Partial<Collection>): Promise<void> {
    await db.collections.update(id, patch);
  }

  async deleteCollection(id: string): Promise<void> {
    await db.collections.delete(id);
  }
}
