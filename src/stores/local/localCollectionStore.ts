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
}
