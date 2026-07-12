import { create } from 'zustand';
import type { Verse, VerseProgress } from '../types';
import { splitVerseIntoWords, maskWord } from '../lib/hint';
import { applyAttemptResult, PASS_ACCURACY_THRESHOLD } from '../lib/srs';
import { calculateVerseXp } from '../lib/xp';
import { progressStore } from '../stores';

export type WordResultKind = 'correct-first-try' | 'correct-after-retry' | 'missed' | 'hinted';

export interface SessionWord {
  prefix: string;
  core: string;
  suffix: string;
  extraRevealed: number;
  hinted: boolean;
  attemptCount: 0 | 1;
  result: WordResultKind | null;
}

export interface CompletedVerseResult {
  verse: Verse;
  accuracy: number;
  passed: boolean;
  xpEarned: number;
  noHints: boolean;
  progress: VerseProgress;
}

type SessionStatus = 'idle' | 'active' | 'session-complete' | 'out-of-hearts';

interface PracticeSessionState {
  status: SessionStatus;
  queue: Verse[];
  verseIndex: number;
  words: SessionWord[];
  wordIndex: number;
  inputValue: string;
  combo: number;
  maxComboSession: number;
  sessionXp: number;
  heartsRemaining: number;
  completedVerses: CompletedVerseResult[];
  flash: 'correct' | 'wrong' | null;

  startSession: (queue: Verse[], startingHearts: number) => void;
  setInputValue: (value: string) => void;
  submitLetter: (letter: string) => Promise<void>;
  submitAttempt: (isCorrect: boolean, opts?: { forceResolve?: boolean }) => Promise<void>;
  useHint: () => void;
  reset: () => void;
}

function wordsForVerse(verse: Verse): SessionWord[] {
  return splitVerseIntoWords(verse.text).map((w) => ({
    prefix: w.prefix,
    core: w.core,
    suffix: w.suffix,
    extraRevealed: 0,
    hinted: false,
    attemptCount: 0,
    result: null,
  }));
}

async function finalizeVerse(state: PracticeSessionState): Promise<Partial<PracticeSessionState>> {
  const verse = state.queue[state.verseIndex];
  const total = state.words.length;
  const correctFirstTry = state.words.filter((w) => w.result === 'correct-first-try').length;
  const accuracy = total === 0 ? 0 : correctFirstTry / total;
  const passed = accuracy >= PASS_ACCURACY_THRESHOLD;
  const noHints = state.words.every((w) => !w.hinted);

  const now = new Date();
  const existingProgress = await progressStore.getProgress(verse.id);
  const progress = existingProgress
    ? applyAttemptResult(existingProgress, accuracy, now)
    : applyAttemptResult(
        {
          verseId: verse.id,
          boxLevel: 0,
          nextReviewDate: now.toISOString().slice(0, 10),
          lastReviewedDate: null,
          consecutiveCorrect: 0,
          totalAttempts: 0,
          totalCorrect: 0,
          bestAccuracy: 0,
          status: 'learning',
        },
        accuracy,
        now
      );
  await progressStore.upsertProgress(progress);

  const xpEarned = calculateVerseXp(
    state.words.map((w) => ({ correct: w.result === 'correct-first-try' || w.result === 'correct-after-retry', hinted: w.hinted })),
    accuracy
  );

  const heartsRemaining = passed ? state.heartsRemaining : Math.max(0, state.heartsRemaining - 1);
  const completedVerses = [
    ...state.completedVerses,
    { verse, accuracy, passed, xpEarned, noHints, progress },
  ];
  const sessionXp = state.sessionXp + xpEarned;

  const nextVerseIndex = state.verseIndex + 1;
  const isLastVerse = nextVerseIndex >= state.queue.length;
  const outOfHearts = heartsRemaining <= 0;

  if (isLastVerse || outOfHearts) {
    return {
      completedVerses,
      sessionXp,
      heartsRemaining,
      status: outOfHearts ? 'out-of-hearts' : 'session-complete',
    };
  }

  const nextVerse = state.queue[nextVerseIndex];
  return {
    completedVerses,
    sessionXp,
    heartsRemaining,
    verseIndex: nextVerseIndex,
    words: wordsForVerse(nextVerse),
    wordIndex: 0,
    inputValue: '',
    combo: 0,
  };
}

export const usePracticeSession = create<PracticeSessionState>((set, get) => ({
  status: 'idle',
  queue: [],
  verseIndex: 0,
  words: [],
  wordIndex: 0,
  inputValue: '',
  combo: 0,
  maxComboSession: 0,
  sessionXp: 0,
  heartsRemaining: 0,
  completedVerses: [],
  flash: null,

  startSession: (queue, startingHearts) => {
    if (queue.length === 0) {
      set({ status: 'session-complete', queue: [] });
      return;
    }
    set({
      status: 'active',
      queue,
      verseIndex: 0,
      words: wordsForVerse(queue[0]),
      wordIndex: 0,
      inputValue: '',
      combo: 0,
      maxComboSession: 0,
      sessionXp: 0,
      heartsRemaining: startingHearts,
      completedVerses: [],
      flash: null,
    });
  },

  setInputValue: (value) => set({ inputValue: value }),

  useHint: () => {
    const { words, wordIndex } = get();
    if (wordIndex >= words.length) return;
    const word = words[wordIndex];
    const nextWords = [...words];
    nextWords[wordIndex] = {
      ...word,
      hinted: true,
      extraRevealed: Math.min(word.core.length - 1, word.extraRevealed + 1),
    };
    set({ words: nextWords, combo: 0 });
  },

  submitLetter: async (letter) => {
    const state = get();
    if (state.status !== 'active' || state.wordIndex >= state.words.length) return;
    const word = state.words[state.wordIndex];
    const correct = word.core.length > 0 && letter.toLowerCase() === word.core[0].toLowerCase();
    await get().submitAttempt(correct);
  },

  // Mode-agnostic attempt bookkeeping shared by every practice mode: attempt count,
  // combo, XP, hearts, SRS box update, and verse/session completion. Each mode's UI
  // determines correctness however fits its own interaction and calls this with the
  // result. `forceResolve` lets a timed mode (Multiple Choice Sprint) force an
  // immediate miss-and-advance on timeout even on a word's first miss, bypassing the
  // one-retry grace period that a manual wrong tap/type still gets.
  submitAttempt: async (isCorrect, opts) => {
    const state = get();
    if (state.status !== 'active' || state.wordIndex >= state.words.length) return;

    const word = state.words[state.wordIndex];

    if (isCorrect) {
      const result: WordResultKind = word.hinted
        ? 'hinted'
        : word.attemptCount === 0
          ? 'correct-first-try'
          : 'correct-after-retry';
      const combo = word.hinted ? 0 : state.combo + 1;
      const maxComboSession = Math.max(state.maxComboSession, combo);

      const words = [...state.words];
      words[state.wordIndex] = { ...word, result };

      const atLastWord = state.wordIndex + 1 >= words.length;
      if (!atLastWord) {
        set({ words, wordIndex: state.wordIndex + 1, inputValue: '', combo, maxComboSession, flash: 'correct' });
        return;
      }

      set({ words, combo, maxComboSession, flash: 'correct' });
      const patch = await finalizeVerse({ ...get(), words });
      set(patch);
      return;
    }

    // incorrect
    const forceResolve = opts?.forceResolve ?? false;
    if (word.attemptCount === 0 && !forceResolve) {
      const words = [...state.words];
      words[state.wordIndex] = { ...word, attemptCount: 1 };
      set({ words, inputValue: '', combo: 0, flash: 'wrong' });
      return;
    }

    // final miss (already retried, or forced by a mode with no retry left): reveal and move on
    const words = [...state.words];
    words[state.wordIndex] = { ...word, result: 'missed', extraRevealed: word.core.length };

    const atLastWord = state.wordIndex + 1 >= words.length;
    if (!atLastWord) {
      set({ words, wordIndex: state.wordIndex + 1, inputValue: '', combo: 0, flash: 'wrong' });
      return;
    }

    set({ words, combo: 0, flash: 'wrong' });
    const patch = await finalizeVerse({ ...get(), words });
    set(patch);
  },

  reset: () =>
    set({
      status: 'idle',
      queue: [],
      verseIndex: 0,
      words: [],
      wordIndex: 0,
      inputValue: '',
      combo: 0,
      maxComboSession: 0,
      sessionXp: 0,
      heartsRemaining: 0,
      completedVerses: [],
      flash: null,
    }),
}));

export function renderMaskedWord(word: SessionWord): string {
  if (word.result !== null) return word.core;
  return maskWord(word.core, word.extraRevealed);
}
