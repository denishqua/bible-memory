import type { UserProfile } from '../../types';
import type { ProfileStore } from '../types';
import { db } from './db';

export const LOCAL_PROFILE_ID = 'local-profile';

export class LocalProfileStore implements ProfileStore {
  getProfile(): Promise<UserProfile | undefined> {
    return db.profile.get(LOCAL_PROFILE_ID);
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<void> {
    await db.profile.update(LOCAL_PROFILE_ID, patch);
  }

  async awardBadge(badgeId: string): Promise<void> {
    const profile = await db.profile.get(LOCAL_PROFILE_ID);
    if (!profile || profile.badges.includes(badgeId)) return;
    await db.profile.update(LOCAL_PROFILE_ID, { badges: [...profile.badges, badgeId] });
  }
}
