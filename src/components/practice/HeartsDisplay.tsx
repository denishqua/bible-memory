interface Props {
  heartsRemaining: number;
  heartsMax: number;
}

export function HeartsDisplay({ heartsRemaining, heartsMax }: Props) {
  return (
    <div
      className="flex items-center gap-1 text-xl"
      title={`${heartsRemaining}/${heartsMax} hearts`}
    >
      {Array.from({ length: heartsMax }).map((_, i) => (
        <span key={i}>{i < heartsRemaining ? '❤️' : '🖤'}</span>
      ))}
    </div>
  );
}
