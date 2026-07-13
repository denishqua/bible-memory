import type { ReactNode } from "react";
import type { Token } from "../../lib/tokenize";

interface BuiltVerseProps {
  /** The full original token stream (including line breaks / verse numbers / reference markers). */
  tokens: Token[];
  /** How many matchable words the player has cleared so far, in order. */
  completedWords: number;
}

// The verse "rebuilding" itself as the player destroys words in the arcade
// modes. Renders the original token stream up through the last cleared word —
// context tokens (line breaks, verse numbers, collection reference markers)
// appear only once a cleared word follows them, so nothing from the not-yet-
// reached part of the verse leaks early.
export function BuiltVerse({ tokens, completedWords }: BuiltVerseProps) {
  const parts: ReactNode[] = [];
  let matchableSeen = 0;
  let pending: Token[] = [];

  const pushContext = (token: Token, key: string) => {
    if (token.isLineBreak) {
      parts.push(<br key={key} />);
      return;
    }
    parts.push(
      <span
        key={key}
        style={{
          fontSize: token.isVerseNumber ? "0.7em" : undefined,
          verticalAlign: token.isVerseNumber ? "super" : "baseline",
          color: "var(--color-ink-muted)",
        }}
      >
        {(token.isVerseNumber ? token.raw.replace(/[[\]]/g, "") : token.raw) + " "}
      </span>,
    );
  };

  for (let i = 0; i < tokens.length && matchableSeen < completedWords; i++) {
    const token = tokens[i];
    if (!token.matchable) {
      pending.push(token);
      continue;
    }
    pending.forEach((p, j) => pushContext(p, `ctx-${i}-${j}`));
    pending = [];
    parts.push(<span key={`word-${i}`}>{token.raw + " "}</span>);
    matchableSeen++;
  }

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "0.85rem 1.1rem",
        borderRadius: "0.7rem",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        minHeight: "3.4rem",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-ink-muted)",
          marginBottom: "0.35rem",
        }}
      >
        Verse so far
      </div>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.05rem",
          lineHeight: 1.7,
          color: "var(--color-ink)",
        }}
      >
        {parts.length > 0 ? (
          parts
        ) : (
          <span style={{ color: "var(--color-ink-muted)" }}>
            Destroy words in order to rebuild the verse…
          </span>
        )}
      </p>
    </div>
  );
}
