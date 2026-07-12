export interface Verse {
  id: string;
  reference: string;
  text: string;
  translation: string;
  wordCount: number;
  createdAt: string;
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  icon?: string;
  order: number;
  verseIds: string[];
}
