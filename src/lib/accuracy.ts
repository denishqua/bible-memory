// Small pure helper shared by useReviewSession (live accuracy while a session is
// in progress) and the session-completion handler (final ReviewResult).
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}
