interface Props {
  value: number;
  max: number;
  colorClassName?: string;
}

export function ProgressBar({ value, max, colorClassName = 'bg-accent' }: Props) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClassName}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
