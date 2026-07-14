// Small pure percentage helper: correct/total as a rounded 0–100, with an
// empty set treated as a perfect 100. The caller decides what "correct" and
// "total" count — useReviewSession passes clean words / total words.
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}
