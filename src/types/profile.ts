export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  xp: number;
  level: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastPracticeDate: string | null;
  hearts: number;
  heartsMax: number;
  lastHeartLostAt: string | null;
  badges: string[];
  createdAt: string;
}
