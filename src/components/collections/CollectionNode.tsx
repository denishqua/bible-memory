import type { Collection } from '../../types';
import { ProgressBar } from '../ui/ProgressBar';

interface Props {
  collection: Collection;
  unlocked: boolean;
  masteredCount: number;
  onSelect: () => void;
}

export function CollectionNode({ collection, unlocked, masteredCount, onSelect }: Props) {
  const total = collection.verseIds.length;
  const complete = total > 0 && masteredCount === total;

  return (
    <button
      onClick={onSelect}
      disabled={!unlocked}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
        unlocked
          ? 'border-border bg-surface hover:bg-surface-2'
          : 'cursor-not-allowed border-border/50 bg-surface/40 opacity-50'
      }`}
    >
      <span className="text-4xl">{unlocked ? collection.icon : '🔒'}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-bold">{collection.title}</h3>
          {complete && <span className="text-xs">✅</span>}
        </div>
        <p className="text-xs text-text-dim">{collection.description}</p>
        {unlocked && (
          <div className="mt-2 flex items-center gap-2">
            <ProgressBar value={masteredCount} max={total} />
            <span className="shrink-0 text-xs text-text-dim">
              {masteredCount}/{total}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
