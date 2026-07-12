export interface Verse {
  id: string;
  reference: string;
  text: string;
  translation: string;
  collectionId: string;
  order: number;
  wordCount: number;
  createdAt: string;
  source: 'seed' | 'user';
}

export type UnlockRule =
  | { type: 'always' }
  | { type: 'requiresCollection'; requiredCollectionId: string }
  | { type: 'requiresLevel'; requiredLevel: number };

export interface Collection {
  id: string;
  title: string;
  description: string;
  icon?: string;
  order: number;
  unlockRule: UnlockRule;
  verseIds: string[];
}
