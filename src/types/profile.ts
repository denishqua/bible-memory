export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastQualifyingDate: string | null; // "YYYY-MM-DD", device-local
}

export interface Profile {
  createdAt: string;
  streak: StreakState;
}
