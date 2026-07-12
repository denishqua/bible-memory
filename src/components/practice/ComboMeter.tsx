interface Props {
  combo: number;
}

export function ComboMeter({ combo }: Props) {
  if (combo < 2) return <div className="h-8" />;

  const intensity = combo >= 10 ? '🔥🔥🔥' : combo >= 5 ? '🔥🔥' : '🔥';

  return (
    <div className="flex h-8 items-center justify-center gap-1 font-bold text-accent-2">
      <span>{intensity}</span>
      <span>{combo}x combo</span>
    </div>
  );
}
