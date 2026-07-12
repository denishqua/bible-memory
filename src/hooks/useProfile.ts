import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import { profileStore } from '../stores';
import { regenHearts } from '../lib/hearts';

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await profileStore.getProfile();
    if (!p) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const now = new Date();
    const { hearts, lastHeartLostAt } = regenHearts(p.hearts, p.heartsMax, p.lastHeartLostAt, now);
    if (hearts !== p.hearts || lastHeartLostAt !== p.lastHeartLostAt) {
      await profileStore.updateProfile({ hearts, lastHeartLostAt });
      setProfile({ ...p, hearts, lastHeartLostAt });
    } else {
      setProfile(p);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      await profileStore.updateProfile(patch);
      await refresh();
    },
    [refresh]
  );

  return { profile, loading, refresh, updateProfile };
}
