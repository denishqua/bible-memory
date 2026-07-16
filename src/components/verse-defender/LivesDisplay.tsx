interface LivesDisplayProps {
  livesRemaining: number; // already clamped >= 0 by the caller
  maxLives: number; // total shield pool for the whole run (shared across verses)
}

export function LivesDisplay({ livesRemaining, maxLives }: LivesDisplayProps) {
  // Collections share one large pool (2 x verse count), so once it grows past a
  // handful of pips we'd be rendering a meaningless row of dots. Switch to a
  // compact glyph + numeric readout instead of scaling the pip count up.
  const compact = maxLives > 8;

  return (
    <div
      aria-label={`${livesRemaining} of ${maxLives} shields remaining`}
      style={{ display: "flex", alignItems: "center", gap: "6px" }}
    >
      <span
        style={{
          fontSize: "0.8rem",
          color: "var(--color-ink-muted)",
          marginRight: "2px",
        }}
      >
        Shields
      </span>
      {compact ? (
        <>
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: livesRemaining > 0 ? "var(--color-clay)" : "transparent",
              border:
                livesRemaining > 0
                  ? "1.5px solid transparent"
                  : "1.5px solid var(--color-border)",
              boxSizing: "border-box",
              transition: "background-color 0.3s ease",
            }}
          />
          <span style={{ fontSize: "0.8rem", color: "var(--color-ink)" }}>
            {livesRemaining} / {maxLives}
          </span>
        </>
      ) : (
        Array.from({ length: maxLives }, (_, index) => {
          const filled = index < livesRemaining;
          return (
            <span
              key={index}
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: filled ? "var(--color-clay)" : "transparent",
                border: filled ? "1.5px solid transparent" : "1.5px solid var(--color-border)",
                boxSizing: "border-box",
                transition: "background-color 0.3s ease",
              }}
            />
          );
        })
      )}
    </div>
  );
}
