export const HEARTS_MAX_DEFAULT = 5;
export const HEART_REGEN_HOURS = 4;

/**
 * Lazily computes how many hearts should have regenerated since the last loss.
 * Called on app open rather than via a background timer, since a PWA isn't
 * guaranteed to run while closed.
 */
export function regenHearts(
  currentHearts: number,
  heartsMax: number,
  lastHeartLostAt: string | null,
  now: Date
): { hearts: number; lastHeartLostAt: string | null } {
  if (currentHearts >= heartsMax || !lastHeartLostAt) {
    return { hearts: currentHearts, lastHeartLostAt };
  }

  const hoursSinceLoss = (now.getTime() - new Date(lastHeartLostAt).getTime()) / (1000 * 60 * 60);
  const regained = Math.floor(hoursSinceLoss / HEART_REGEN_HOURS);
  if (regained <= 0) {
    return { hearts: currentHearts, lastHeartLostAt };
  }

  const hearts = Math.min(heartsMax, currentHearts + regained);
  // If fully regenerated, clear the timestamp; otherwise carry the remainder forward
  // so the next heart's regen timer doesn't restart from "now".
  const remainderMs = (hoursSinceLoss % HEART_REGEN_HOURS) * 60 * 60 * 1000;
  const newLastLostAt = hearts >= heartsMax ? null : new Date(now.getTime() - remainderMs).toISOString();

  return { hearts, lastHeartLostAt: newLastLostAt };
}

export function hoursUntilNextHeart(lastHeartLostAt: string | null, now: Date): number {
  if (!lastHeartLostAt) return 0;
  const hoursSinceLoss = (now.getTime() - new Date(lastHeartLostAt).getTime()) / (1000 * 60 * 60);
  return Math.max(0, HEART_REGEN_HOURS - hoursSinceLoss);
}
