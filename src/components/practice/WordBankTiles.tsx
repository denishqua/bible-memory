import { useEffect, useRef, useState } from 'react';
import { usePracticeSession } from '../../hooks/usePracticeSession';
import { isWordCorrect } from '../../lib/hint';
import { shuffle } from '../../lib/distractors';

interface Tile {
  id: number;
  text: string;
}

interface Props {
  reference: string;
}

export function WordBankTiles({ reference }: Props) {
  const words = usePracticeSession((s) => s.words);
  const wordIndex = usePracticeSession((s) => s.wordIndex);
  const submitAttempt = usePracticeSession((s) => s.submitAttempt);

  const [tray, setTray] = useState<Tile[]>(() => shuffle(words.map((w, i) => ({ id: i, text: w.core }))));
  const [shakeId, setShakeId] = useState<number | null>(null);
  const prevWordIndexRef = useRef(wordIndex);

  // Whenever the word index advances (correct tap or the final auto-reveal on a
  // miss), remove one matching tile from the tray so tile count stays in sync with
  // resolved words, regardless of which physical tile the user tapped.
  useEffect(() => {
    if (wordIndex > prevWordIndexRef.current) {
      const resolvedWord = words[prevWordIndexRef.current];
      if (resolvedWord) {
        setTray((prev) => {
          const idx = prev.findIndex((t) => isWordCorrect(t.text, resolvedWord.core));
          if (idx === -1) return prev;
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
      }
    }
    prevWordIndexRef.current = wordIndex;
  }, [wordIndex, words]);

  function handleTap(tile: Tile) {
    const current = words[wordIndex];
    if (!current) return;
    const correct = isWordCorrect(tile.text, current.core);
    if (!correct) {
      setShakeId(tile.id);
      setTimeout(() => setShakeId((id) => (id === tile.id ? null : id)), 300);
    }
    submitAttempt(correct);
  }

  const builtWords = words.slice(0, wordIndex);
  const currentWord = words[wordIndex];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-dim">{reference}</p>
        <p className="min-h-10 font-mono text-xl leading-relaxed tracking-wide sm:text-2xl">
          {builtWords.map((word, i) => (
            <span key={i} className={word.result === 'missed' ? 'text-danger' : 'text-accent'}>
              {word.prefix}
              {word.core}
              {word.suffix}{' '}
            </span>
          ))}
          {currentWord && <span className="rounded bg-accent-2/20 px-1 text-accent-2">▁▁▁</span>}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {tray.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => handleTap(tile)}
            className={`rounded-xl border-2 bg-surface-2 px-4 py-2 text-lg font-semibold transition-transform ${
              shakeId === tile.id ? 'animate-shake border-danger' : 'border-border hover:border-accent-2'
            }`}
          >
            {tile.text}
          </button>
        ))}
      </div>
    </div>
  );
}
