import { useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { useCollections } from '../hooks/useCollections';
import { useProgress } from '../hooks/useProgress';
import { todayISODate } from '../lib/srs';
import { StatsBar } from '../components/profile/StatsBar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function HomePage() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { collections, loading: collectionsLoading } = useCollections();
  const { progressByVerseId, loading: progressLoading } = useProgress();

  const loading = profileLoading || collectionsLoading || progressLoading;

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-center text-text-dim">Loading…</p>
      </div>
    );
  }

  const today = todayISODate(new Date());
  const dueCount = collections.reduce(
    (count, c) =>
      count + c.verseIds.filter((id) => (progressByVerseId.get(id)?.nextReviewDate ?? '') <= today).length,
    0
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bible Memory</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/add-verse')}>
            + Verse
          </Button>
          <Button variant="ghost" onClick={() => navigate('/profile')}>
            Profile
          </Button>
        </div>
      </div>

      <StatsBar profile={profile} />

      {dueCount > 0 && (
        <Card className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">Review All Due</h3>
            <p className="text-xs text-text-dim">
              {dueCount} verse{dueCount === 1 ? '' : 's'} due today across all your sets
            </p>
          </div>
          <Button onClick={() => navigate('/practice/review-due')}>Start</Button>
        </Card>
      )}

      <Card className="flex items-center justify-between">
        <div>
          <h3 className="font-bold">My Sets</h3>
          <p className="text-xs text-text-dim">
            {collections.length === 0
              ? 'No sets yet — add a verse, then create your first set.'
              : `${collections.length} set${collections.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/sets')}>
          Manage
        </Button>
      </Card>
    </div>
  );
}
