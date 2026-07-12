import type { Badge, UserProfile, VerseProgress } from '../types';

export const BADGE_CATALOG: Badge[] = [
  { id: 'first_verse', title: 'First Steps', description: 'Complete your first verse.', icon: '🌱' },
  { id: 'week_streak', title: 'Week Warrior', description: 'Reach a 7-day streak.', icon: '🔥' },
  { id: 'month_streak', title: 'Steadfast', description: 'Reach a 30-day streak.', icon: '🏆' },
  { id: 'no_hints_verse', title: 'Sharp Mind', description: 'Complete a verse with zero hints.', icon: '🧠' },
  { id: 'combo_10', title: 'On a Roll', description: 'Reach a 10-word combo in one verse.', icon: '⚡' },
];

export function collectionCompleteBadgeId(collectionId: string): string {
  return `collection_complete:${collectionId}`;
}

export interface SessionBadgeContext {
  isFirstVerseEver: boolean;
  verseCompletedWithNoHints: boolean;
  maxComboThisSession: number;
  justCompletedCollectionIds: string[];
}

/** Pure badge-check run once at session end; returns newly earned badge ids (excludes already-earned). */
export function checkBadges(
  profile: UserProfile,
  ctx: SessionBadgeContext,
  _allProgress: VerseProgress[]
): string[] {
  const earned = new Set(profile.badges);
  const newly: string[] = [];

  const award = (id: string) => {
    if (!earned.has(id)) {
      earned.add(id);
      newly.push(id);
    }
  };

  if (ctx.isFirstVerseEver) award('first_verse');
  if (profile.currentStreakDays >= 7) award('week_streak');
  if (profile.currentStreakDays >= 30) award('month_streak');
  if (ctx.verseCompletedWithNoHints) award('no_hints_verse');
  if (ctx.maxComboThisSession >= 10) award('combo_10');
  for (const collectionId of ctx.justCompletedCollectionIds) {
    award(collectionCompleteBadgeId(collectionId));
  }

  return newly;
}
