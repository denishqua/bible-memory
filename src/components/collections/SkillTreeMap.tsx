import type { Collection, VerseProgress } from '../../types';
import { collectionMasteredCount, isCollectionUnlocked } from '../../lib/collectionProgress';
import { CollectionNode } from './CollectionNode';

interface Props {
  collections: Collection[];
  collectionsById: Map<string, Collection>;
  progressByVerseId: Map<string, VerseProgress>;
  profileLevel: number;
  onSelect: (collectionId: string) => void;
}

export function SkillTreeMap({ collections, collectionsById, progressByVerseId, profileLevel, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {collections.map((collection) => (
        <CollectionNode
          key={collection.id}
          collection={collection}
          unlocked={isCollectionUnlocked(collection, collectionsById, progressByVerseId, profileLevel)}
          masteredCount={collectionMasteredCount(collection, progressByVerseId)}
          onSelect={() => onSelect(collection.id)}
        />
      ))}
    </div>
  );
}
