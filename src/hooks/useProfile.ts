import { useCallback, useEffect, useState } from "react";
import { useStorage } from "../data/storageContext";
import type { Profile } from "../types/profile";

// Multiple components mount their own useProfile() instance (the header's
// FlameStreakBadge lives for the whole app lifetime, while a review session
// lives inside a page far below it in the tree) but there's no shared store —
// per the plan, "Context + hooks is enough," not a state library. This tiny
// window event is the cheapest way to keep every instance in sync: whoever
// calls updateProfile() broadcasts it, and every mounted useProfile() instance
// (including ones in totally different components) re-fetches from storage.
export const PROFILE_UPDATED_EVENT = "bm:profile-updated";

export function useProfile() {
  const storage = useStorage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await storage.getProfile();
    setProfile(next);
    setLoading(false);
  }, [storage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleExternalUpdate = () => {
      refresh();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleExternalUpdate);
  }, [refresh]);

  const updateProfile = useCallback(
    async (next: Profile): Promise<void> => {
      await storage.saveProfile(next);
      setProfile(next);
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
    },
    [storage],
  );

  return { profile, loading, updateProfile, refresh };
}
