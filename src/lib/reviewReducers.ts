import { charsMatch } from "./keyboard";
import type { WordRuntimeState } from "../hooks/useReviewSession";

export interface InternalState {
  words: WordRuntimeState[];
  currentIndex: number;
}

export function firstPendingMatchableIndex(words: WordRuntimeState[], from: number): number {
  let i = from;
  while (i < words.length && !words[i].token.matchable) {
    i++;
  }
  return i;
}

export function reduceFirstLetterInput(prev: InternalState, char: string): InternalState {
  if (prev.currentIndex >= prev.words.length) return prev;

  const currentWord = prev.words[prev.currentIndex];
  const words = prev.words.slice();
  const expected = currentWord.token.normalized[0];
  const isMatch = charsMatch(char, expected);

  if (isMatch) {
    words[prev.currentIndex] = { ...currentWord, completed: true };
    const nextIndex = firstPendingMatchableIndex(words, prev.currentIndex + 1);
    return { words, currentIndex: nextIndex };
  }

  words[prev.currentIndex] = { ...currentWord, attempts: currentWord.attempts + 1 };
  return { ...prev, words };
}

export function reduceWholeWordInput(prev: InternalState, char: string): InternalState {
  if (prev.currentIndex >= prev.words.length) return prev;

  const currentWord = prev.words[prev.currentIndex];
  const words = prev.words.slice();
  const fullyTyped = currentWord.typedCount === currentWord.token.normalized.length;

  if (char === " ") {
    if (!fullyTyped) return prev;
    words[prev.currentIndex] = { ...currentWord, completed: true };
    const nextIndex = firstPendingMatchableIndex(words, prev.currentIndex + 1);
    return { words, currentIndex: nextIndex };
  }

  const expected = currentWord.token.normalized[currentWord.typedCount];
  const isMatch = charsMatch(char, expected);

  if (isMatch) {
    const typedCount = currentWord.typedCount + 1;
    if (typedCount === currentWord.token.normalized.length) {
      const nextIndex = firstPendingMatchableIndex(words, prev.currentIndex + 1);
      if (nextIndex >= words.length || currentWord.token.attachNext) {
        words[prev.currentIndex] = { ...currentWord, typedCount, completed: true };
        return { words, currentIndex: nextIndex };
      }
    }
    words[prev.currentIndex] = { ...currentWord, typedCount };
    return { ...prev, words };
  }

  const revealedCount = Math.min(
    currentWord.token.normalized.length,
    Math.max(currentWord.revealedCount, currentWord.typedCount) + 1,
  );
  words[prev.currentIndex] = {
    ...currentWord,
    attempts: currentWord.attempts + 1,
    revealedCount,
  };
  return { ...prev, words };
}
