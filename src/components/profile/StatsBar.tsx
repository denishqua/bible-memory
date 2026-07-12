import type { UserProfile } from '../../types';
import { xpProgressWithinLevel } from '../../lib/xp';
import { ProgressBar } from '../ui/ProgressBar';

interface Props {
  profile: UserProfile;
}

export function StatsBar({ profile }: Props) {
  const { level, into, span } = xpProgressWithinLevel(profile.xp);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-2xl" title={`${profile.currentStreakDays}-day streak`}>
        🔥 <span className="text-lg font-bold">{profile.currentStreakDays}</span>
      </div>

      <div className="flex min-w-[140px] flex-1 items-center gap-2">
        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-1 text-xs font-bold text-accent-2">
          Lv {level}
        </span>
        <ProgressBar value={into} max={span} colorClassName="bg-accent-2" />
      </div>

      <div className="flex items-center gap-1 text-xl" title={`${profile.hearts}/${profile.heartsMax} hearts`}>
        {Array.from({ length: profile.heartsMax }).map((_, i) => (
          <span key={i}>{i < profile.hearts ? '❤️' : '🖤'}</span>
        ))}
      </div>
    </div>
  );
}
