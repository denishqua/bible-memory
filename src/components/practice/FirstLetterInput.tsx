import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

interface Props {
  flash: 'correct' | 'wrong' | null;
  onLetter: (letter: string) => void;
}

/**
 * Captures a single keypress and checks it against the next word's first letter —
 * a real <input> (not a bare focusable div) so it still brings up the on-screen
 * keyboard on mobile. preventDefault on letter keys keeps the box always empty
 * visually; we only ever care about the single most recent keypress.
 */
export function FirstLetterInput({ flash, onLetter }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [flash]);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key.length === 1) {
      e.preventDefault();
      onLetter(e.key);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onChange={() => {}}
        value=""
        className={`w-20 rounded-xl border-2 bg-surface-2 py-4 text-center text-2xl font-bold uppercase outline-none transition-colors ${
          flash === 'correct'
            ? 'border-accent'
            : flash === 'wrong'
              ? 'border-danger'
              : 'border-border focus:border-accent-2'
        }`}
        placeholder="?"
      />
      <p className="text-xs text-text-dim">Press the first letter of the next word</p>
    </div>
  );
}
