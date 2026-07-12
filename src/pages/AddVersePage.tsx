import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollections } from '../hooks/useCollections';
import { useVerses } from '../hooks/useVerses';
import { splitVerseIntoWords } from '../lib/hint';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function AddVersePage() {
  const navigate = useNavigate();
  const { collections, loading: collectionsLoading } = useCollections();
  const { verses, addVerse } = useVerses();

  const [reference, setReference] = useState('');
  const [text, setText] = useState('');
  const [translation, setTranslation] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedCollectionId = collectionId || collections[0]?.id || '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reference.trim() || !text.trim() || !selectedCollectionId || submitting) return;

    setSubmitting(true);
    const versesInCollection = verses.filter((v) => v.collectionId === selectedCollectionId);
    const maxOrder = versesInCollection.reduce((max, v) => Math.max(max, v.order), -1);

    await addVerse({
      id: crypto.randomUUID(),
      reference: reference.trim(),
      text: text.trim(),
      translation: translation.trim() || 'Custom',
      collectionId: selectedCollectionId,
      order: maxOrder + 1,
      wordCount: splitVerseIntoWords(text).length,
      createdAt: new Date().toISOString(),
      source: 'user',
    });

    navigate('/');
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Add a Verse</h1>
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Home
        </Button>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">
              Reference
            </span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. John 3:16"
              className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">
              Verse Text
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type the verse text…"
              rows={4}
              className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">
              Translation
            </span>
            <input
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="Type your own"
              className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">
              Collection
            </span>
            <select
              value={selectedCollectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              disabled={collectionsLoading}
              className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent-2"
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <Button type="submit" disabled={submitting}>
            Save Verse
          </Button>
        </form>
      </Card>
    </div>
  );
}
