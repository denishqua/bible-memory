import type { UserProfile } from '../types';
import { todayISODate, addDaysISODate } from './srs';

export function applyPracticeToStreak(
  profile: Pick<UserProfile, 'currentStreakDays' | 'longestStreakDays' | 'lastPracticeDate'>,
  now: Date
): Pick<UserProfile, 'currentStreakDays' | 'longestStreakDays' | 'lastPracticeDate'> {
  const today = todayISODate(now);

  if (profile.lastPracticeDate === today) {
    return profile;
  }

  const yesterday = addDaysISODate(today, -1);
  const continuing = profile.lastPracticeDate === yesterday;
  const currentStreakDays = continuing ? profile.currentStreakDays + 1 : 1;

  return {
    currentStreakDays,
    longestStreakDays: Math.max(profile.longestStreakDays, currentStreakDays),
    lastPracticeDate: today,
  };
}
