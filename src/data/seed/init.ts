import { db, LOCAL_PROFILE_ID } from '../../stores';
import { SEED_COLLECTIONS } from './collections.seed';
import { SEED_VERSES } from './verses.seed';
import { createInitialProgress } from '../../lib/srs';
import { HEARTS_MAX_DEFAULT } from '../../lib/hearts';
import type { UserProfile } from '../../types';

/** Seeds collections, verses, initial progress, and a default profile on first run only. */
export async function ensureSeeded(now: Date): Promise<void> {
  const existingProfile = await db.profile.get(LOCAL_PROFILE_ID);
  if (existingProfile) return;

  await db.transaction('rw', db.collections, db.verses, db.progress, db.profile, async () => {
    await db.collections.bulkPut(SEED_COLLECTIONS);
    await db.verses.bulkPut(SEED_VERSES);
    await db.progress.bulkPut(SEED_VERSES.map((v) => createInitialProgress(v.id, now)));

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
  });
}
