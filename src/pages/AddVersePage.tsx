import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVerses } from '../hooks/useVerses';
import { splitVerseIntoWords } from '../lib/hint';
import { fetchEsvPassage } from '../lib/esvApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function AddVersePage() {
  const navigate = useNavigate();
  const { addVerse } = useVerses();

  const [reference, setReference] = useState('');
  const [text, setText] = useState('');
  const [translation, setTranslation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImportFromEsv() {
    if (!reference.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await fetchEsvPassage(reference.trim());
      setReference(result.reference);
      setText(result.text);
      setTranslation('ESV');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to fetch from ESV.');
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reference.trim() || !text.trim() || submitting) return;

    setSubmitting(true);
    await addVerse({
      id: crypto.randomUUID(),
      reference: reference.trim(),
      text: text.trim(),
      translation: translation.trim() || 'Custom',
      wordCount: splitVerseIntoWords(text).length,
      createdAt: new Date().toISOString(),
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
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Reference</span>
            <div className="flex gap-2">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. John 3:16"
                className="flex-1 rounded-xl border-2 border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent-2"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleImportFromEsv}
                disabled={!reference.trim() || importing}
              >
                {importing ? 'Fetching…' : 'Fetch from ESV'}
              </Button>
            </div>
            {importError && <span className="text-xs text-danger">{importError}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Verse Text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type the verse text, or fetch it from ESV above…"
              rows={4}
              className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Translation</span>
            <input
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="Type your own"
              className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent-2"
            />
          </label>

          <Button type="submit" disabled={submitting || !reference.trim() || !text.trim()}>
            Save Verse
          </Button>

          <p className="text-center text-[10px] leading-relaxed text-text-dim">
            Scripture quotations marked ESV are from the ESV® Bible (The Holy Bible, English Standard
            Version®), copyright © 2001 by Crossway. Used by permission. All rights reserved.
          </p>
        </form>
      </Card>
    </div>
  );
}
