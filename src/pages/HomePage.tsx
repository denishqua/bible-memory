import { useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { useCollections } from '../hooks/useCollections';
import { useProgress } from '../hooks/useProgress';
import { StatsBar } from '../components/profile/StatsBar';
import { SkillTreeMap } from '../components/collections/SkillTreeMap';
import { Button } from '../components/ui/Button';

export function HomePage() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { collections, collectionsById, loading: collectionsLoading } = useCollections();
  const { progressByVerseId, loading: progressLoading } = useProgress();

  const loading = profileLoading || collectionsLoading || progressLoading;

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

      <SkillTreeMap
        collections={collections}
        collectionsById={collectionsById}
        progressByVerseId={progressByVerseId}
        profileLevel={profile.level}
        onSelect={(collectionId) => navigate(`/practice/${collectionId}`)}
      />
    </div>
  );
}
