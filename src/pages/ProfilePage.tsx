import { useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { StatsBar } from '../components/profile/StatsBar';
import { BadgeGrid } from '../components/profile/BadgeGrid';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-center text-text-dim">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profile</h1>
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Home
        </Button>
      </div>

      <StatsBar profile={profile} />

      <Card className="flex items-center justify-around text-center">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{profile.longestStreakDays}</span>
          <span className="text-xs uppercase tracking-wide text-text-dim">Longest streak</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{profile.xp}</span>
          <span className="text-xs uppercase tracking-wide text-text-dim">Total XP</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{profile.badges.length}</span>
          <span className="text-xs uppercase tracking-wide text-text-dim">Badges</span>
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-text-dim">Badges</h2>
        <BadgeGrid earnedBadgeIds={profile.badges} />
      </div>
    </div>
  );
}
