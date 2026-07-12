import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';

interface Props {
  value: string;
  flash: 'correct' | 'wrong' | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function WordInput({ value, flash, onChange, onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [flash]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim().length === 0) return;
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        placeholder="Type the word…"
        className={`flex-1 rounded-xl border-2 bg-surface-2 px-4 py-3 text-lg outline-none transition-colors ${
          flash === 'correct'
            ? 'border-accent'
            : flash === 'wrong'
              ? 'border-danger'
              : 'border-border focus:border-accent-2'
        }`}
      />
      <button
        type="submit"
        className="rounded-xl bg-accent px-5 py-3 font-bold uppercase text-bg transition-colors hover:bg-accent/90"
      >
        Go
      </button>
    </form>
  );
}
