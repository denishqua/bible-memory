import { useEffect, useMemo, useRef, useState } from 'react';
import { usePracticeSession } from '../../hooks/usePracticeSession';
import { isWordCorrect } from '../../lib/hint';
import { pickDistractors, shuffle } from '../../lib/distractors';

export const SPRINT_TIME_LIMIT_MS = 5000;
const OPTION_COUNT = 4;

interface Props {
  reference: string;
}

export function MultipleChoiceSprint({ reference }: Props) {
  const words = usePracticeSession((s) => s.words);
  const wordIndex = usePracticeSession((s) => s.wordIndex);
  const submitAttempt = usePracticeSession((s) => s.submitAttempt);

  const currentWord = words[wordIndex];
  const [remainingMs, setRemainingMs] = useState(SPRINT_TIME_LIMIT_MS);
  const [pickedOption, setPickedOption] = useState<string | null>(null);
  const [wasWrong, setWasWrong] = useState(false);
  const resolvedRef = useRef(false);

  const options = useMemo(() => {
    if (!currentWord) return [];
    const distractors = pickDistractors(
      currentWord.core,
      words.map((w) => w.core),
      OPTION_COUNT - 1
    );
    return shuffle([currentWord.core, ...distractors]);
    // Recompute only when the word changes, not on every retry/render, so the
    // option set stays stable across a wrong tap's one-retry grace period.
    // eslint-disable-next-line
  }, [wordIndex]);

  // Countdown is per-word, not per-attempt: it keeps running across a retry within
  // the same word, and only resets when the word actually advances.
  useEffect(() => {
    resolvedRef.current = false;
    setPickedOption(null);
    setWasWrong(false);
    setRemainingMs(SPRINT_TIME_LIMIT_MS);

    const start = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, SPRINT_TIME_LIMIT_MS - (Date.now() - start));
      setRemainingMs(left);
      if (left <= 0) {
        window.clearInterval(tick);
        if (!resolvedRef.current) {
          resolvedRef.current = true;
          submitAttempt(false, { forceResolve: true });
        }
      }
    }, 100);

    return () => window.clearInterval(tick);
  }, [wordIndex, submitAttempt]);

  function handleSelect(option: string) {
    if (!currentWord || resolvedRef.current) return;
    const correct = isWordCorrect(option, currentWord.core);
    const willResolve = correct || currentWord.attemptCount === 1;
    if (willResolve) resolvedRef.current = true;
    setPickedOption(option);
    setWasWrong(!correct);
    submitAttempt(correct);
  }

  if (!currentWord) return null;

  const pct = Math.max(0, Math.round((remainingMs / SPRINT_TIME_LIMIT_MS) * 100));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-dim">{reference}</p>
        <p className="font-mono text-xl leading-relaxed tracking-wide sm:text-2xl">
          {words.map((word, i) => (
            <span
              key={i}
              className={
                i === wordIndex
                  ? 'rounded bg-accent-2/20 px-1 text-accent-2'
                  : word.result === 'missed'
                    ? 'text-danger'
                    : word.result
                      ? 'text-accent'
                      : ''
              }
            >
              {i < wordIndex ? `${word.prefix}${word.core}${word.suffix}` : i === wordIndex ? '•••' : ''}
              {' '}
            </span>
          ))}
        </p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full transition-[width] duration-100 ease-linear ${pct <= 25 ? 'bg-danger' : 'bg-accent-2'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={resolvedRef.current}
            onClick={() => handleSelect(opt)}
            className={`rounded-xl border-2 px-4 py-3 text-lg font-semibold transition-colors disabled:cursor-not-allowed ${
              pickedOption === opt
                ? wasWrong
                  ? 'border-danger'
                  : 'border-accent'
                : 'border-border bg-surface-2 hover:border-accent-2'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
