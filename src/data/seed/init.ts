import { db, LOCAL_PROFILE_ID } from '../../stores';
import { HEARTS_MAX_DEFAULT } from '../../lib/hearts';
import type { UserProfile } from '../../types';

/** Creates the default local profile on first run only. No verses/sets are seeded — the user starts empty. */
export async function ensureSeeded(now: Date): Promise<void> {
  const existingProfile = await db.profile.get(LOCAL_PROFILE_ID);
  if (existingProfile) return;

  const profile: UserProfile = {
    id: LOCAL_PROFILE_ID,
    displayName: 'Friend',
    xp: 0,
    level: 1,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastPracticeDate: null,
    hearts: HEARTS_MAX_DEFAULT,
    heartsMax: HEARTS_MAX_DEFAULT,
    lastHeartLostAt: null,
    badges: [],
    createdAt: now.toISOString(),
  };
  await db.profile.put(profile);
}
