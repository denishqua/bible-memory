import { BADGE_CATALOG } from '../../lib/badges';

interface Props {
  earnedBadgeIds: string[];
}

export function BadgeGrid({ earnedBadgeIds }: Props) {
  const earned = new Set(earnedBadgeIds);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {BADGE_CATALOG.map((badge) => {
        const isEarned = earned.has(badge.id);
        return (
          <div
            key={badge.id}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center ${
              isEarned ? 'border-accent-2/50 bg-surface-2' : 'border-border bg-surface opacity-40'
            }`}
          >
            <span className="text-3xl">{badge.icon}</span>
            <span className="text-xs font-bold">{badge.title}</span>
            <span className="text-[10px] text-text-dim">{badge.description}</span>
          </div>
        );
      })}
    </div>
  );
}
