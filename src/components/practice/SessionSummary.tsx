import type { Badge } from '../../types';
import { BADGE_CATALOG } from '../../lib/badges';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface Props {
  sessionXp: number;
  versesReviewed: number;
  newBadgeIds: string[];
  streakDays: number;
  outOfHearts: boolean;
  onDone: () => void;
}

export function SessionSummary({
  sessionXp,
  versesReviewed,
  newBadgeIds,
  streakDays,
  outOfHearts,
  onDone,
}: Props) {
  const newBadges: Badge[] = newBadgeIds
    .map((id) => BADGE_CATALOG.find((b) => b.id === id))
    .filter((b): b is Badge => Boolean(b));

  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
      <h2 className="text-2xl font-bold">
        {outOfHearts ? 'Out of Hearts' : 'Session Complete!'}
      </h2>

      {outOfHearts && (
        <p className="text-sm text-text-dim">
          You're out of hearts for now — come back later once they regenerate.
        </p>
      )}

      <div className="flex w-full items-center justify-around">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-accent-2">+{sessionXp}</span>
          <span className="text-xs uppercase tracking-wide text-text-dim">XP earned</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{versesReviewed}</span>
          <span className="text-xs uppercase tracking-wide text-text-dim">Verses reviewed</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">🔥 {streakDays}</span>
          <span className="text-xs uppercase tracking-wide text-text-dim">Day streak</span>
        </div>
      </div>

      {newBadges.length > 0 && (
        <div className="w-full">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-text-dim">
            New Badges!
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {newBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-1 rounded-xl border border-accent-2/50 bg-surface-2 p-3"
              >
                <span className="text-3xl">{badge.icon}</span>
                <span className="text-xs font-bold">{badge.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button onClick={onDone} className="mt-2 w-full">
        Done
      </Button>
    </Card>
  );
}
