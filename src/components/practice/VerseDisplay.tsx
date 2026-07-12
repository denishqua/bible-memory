import type { SessionWord } from '../../hooks/usePracticeSession';
import { renderMaskedWord } from '../../hooks/usePracticeSession';

interface Props {
  reference: string;
  words: SessionWord[];
  currentWordIndex: number;
}

export function VerseDisplay({ reference, words, currentWordIndex }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-dim">{reference}</p>
      <p className="font-mono text-xl leading-relaxed tracking-wide sm:text-2xl">
        {words.map((word, i) => (
          <span
            key={i}
            className={
              i === currentWordIndex
                ? 'rounded bg-accent-2/20 px-1 text-accent-2'
                : word.result === 'missed'
                  ? 'text-danger'
                  : word.result
                    ? 'text-accent'
                    : ''
            }
          >
            {word.prefix}
            {renderMaskedWord(word)}
            {word.suffix}{' '}
          </span>
        ))}
      </p>
    </div>
  );
}
