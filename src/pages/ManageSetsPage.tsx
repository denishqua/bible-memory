import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollections } from '../hooks/useCollections';
import { useVerses } from '../hooks/useVerses';
import { useProgress } from '../hooks/useProgress';
import type { Collection } from '../types';
import { collectionMasteredCount } from '../lib/collectionProgress';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type Mode = { view: 'list' } | { view: 'edit'; setId: string | null };

export function ManageSetsPage() {
  const navigate = useNavigate();
  const { collections, loading: collectionsLoading, addCollection, updateCollection, deleteCollection } =
    useCollections();
  const { verses, loading: versesLoading } = useVerses();
  const { progressByVerseId } = useProgress();

  const [mode, setMode] = useState<Mode>({ view: 'list' });

  const loading = collectionsLoading || versesLoading;

  async function handleDelete(id: string) {
    if (!confirm('Delete this set? This only removes the set, not the verses in it.')) return;
    await deleteCollection(id);
  }

  if (mode.view === 'edit') {
    return (
      <SetEditor
        setId={mode.setId}
        collections={collections}
        verses={verses}
        onCancel={() => setMode({ view: 'list' })}
        onSave={async (setData) => {
          if (mode.setId) {
            await updateCollection(mode.setId, setData);
          } else {
            const maxOrder = collections.reduce((max, c) => Math.max(max, c.order), -1);
            const newCollection: Collection = {
              id: crypto.randomUUID(),
              title: setData.title!,
              description: setData.description ?? '',
              order: maxOrder + 1,
              verseIds: setData.verseIds!,
            };
            await addCollection(newCollection);
          }
          setMode({ view: 'list' });
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Sets</h1>
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Home
        </Button>
      </div>

      <p className="text-sm text-text-dim">
        Group any verses from your library into a named set you can practice together.
      </p>

      <Button onClick={() => setMode({ view: 'edit', setId: null })}>+ Create New Set</Button>

      {loading ? (
        <p className="text-center text-text-dim">Loading…</p>
      ) : collections.length === 0 ? (
        <Card>
          <p className="text-center text-text-dim">
            No sets yet. Add some verses first, then create a set above.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map((set) => {
            const mastered = collectionMasteredCount(set, progressByVerseId);
            return (
              <Card key={set.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-bold">{set.title}</h3>
                  <p className="text-xs text-text-dim">
                    {mastered}/{set.verseIds.length} mastered
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="primary" onClick={() => navigate(`/practice/${set.id}`)}>
                    Practice
                  </Button>
                  <Button variant="secondary" onClick={() => setMode({ view: 'edit', setId: set.id })}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => handleDelete(set.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SetEditorProps {
  setId: string | null;
  collections: Collection[];
  verses: ReturnType<typeof useVerses>['verses'];
  onCancel: () => void;
  onSave: (data: Partial<Collection> & { title?: string; verseIds?: string[] }) => Promise<void>;
}

function SetEditor({ setId, collections, verses, onCancel, onSave }: SetEditorProps) {
  const existing = setId ? collections.find((c) => c.id === setId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [selectedVerseIds, setSelectedVerseIds] = useState<Set<string>>(new Set(existing?.verseIds ?? []));
  const [saving, setSaving] = useState(false);

  function toggleVerse(verseId: string) {
    setSelectedVerseIds((prev) => {
      const next = new Set(prev);
      if (next.has(verseId)) {
        next.delete(verseId);
      } else {
        next.add(verseId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim() || selectedVerseIds.size === 0 || saving) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: existing?.description ?? '',
      verseIds: Array.from(selectedVerseIds),
    });
    setSaving(false);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{setId ? 'Edit Set' : 'Create New Set'}</h1>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Set Name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Verses for youth talk"
            className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent-2"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-text-dim">
            Verses ({selectedVerseIds.size} selected)
          </span>
          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-xl border-2 border-border bg-surface-2 p-4">
            {verses.length === 0 ? (
              <p className="text-center text-sm text-text-dim">
                No verses in your library yet — add some first.
              </p>
            ) : (
              verses.map((verse) => (
                <label
                  key={verse.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={selectedVerseIds.has(verse.id)}
                    onChange={() => toggleVerse(verse.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-sm">{verse.reference}</span>
                  <span className="text-xs text-text-dim">({verse.translation})</span>
                </label>
              ))
            )}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || !title.trim() || selectedVerseIds.size === 0}>
          Save Set
        </Button>
      </Card>
    </div>
  );
}
