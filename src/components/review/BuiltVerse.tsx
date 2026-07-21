import { useEffect, useRef, type ReactNode } from "react";
import { isBetweenVerseReferenceMarker, type Token } from "../../lib/tokenize";

interface BuiltVerseProps {
  /** The full original token stream (including line breaks / verse numbers / reference markers). */
  tokens: Token[];
  /** How many matchable words the player has cleared so far, in order. */
  completedWords: number;
}

/**
 * Divider tokens render as their own block line rather than inline: the
 * collection between-verse markers ("— Romans 8:28 —", non-matchable and not a
 * line break / verse number / reference) and the single verse→reference
 * delimiter. A reference's own punctuation tokens (":", "-") are non-matchable +
 * isReference but must stay inline, so they are deliberately excluded.
 */
function isDivider(token: Token): boolean {
  if (token.isReferenceDelimiter) return true;
  return isBetweenVerseReferenceMarker(token);
}

// The verse "rebuilding" itself as the player destroys words in the arcade
// modes. Renders the original token stream up through the last cleared word —
// context tokens (line breaks, verse numbers, collection reference markers)
// appear only once a cleared word follows them, so nothing from the not-yet-
// reached part of the verse leaks early. Long bulk runs stay usable: the text
// area is capped in height and auto-scrolls so the newest words are always in
// view, and reference markers render as their own divider lines rather than
// inline noise.
export function BuiltVerse({ tokens, completedWords }: BuiltVerseProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest words visible as the verse grows past the height cap.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [completedWords]);

  const parts: ReactNode[] = [];
  let matchableSeen = 0;
  let pending: Token[] = [];

  const pushContext = (token: Token, key: string) => {
    if (token.isLineBreak) {
      parts.push(<br key={key} />);
      return;
    }
    if (isDivider(token)) {
      // A verse boundary in a collection run — set it off as a divider line
      // instead of flowing inline with the words around it.
      parts.push(
        <span
          key={key}
          style={{
            display: "block",
            margin: "0.5em 0 0.15em",
            fontFamily: "var(--font-sans)",
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--color-clay)",
          }}
        >
          {token.raw.replace(/^—\s*|\s*—$/g, "")}
        </span>,
      );
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
        {(token.isVerseNumber ? token.raw.replace(/[[\]]/g, "") : token.raw) +
          (token.attachNext ? "" : " ")}
      </span>,
    );
  };

  for (let i = 0; i < tokens.length && matchableSeen < completedWords; i++) {
    const token = tokens[i];
    if (!token.matchable) {
      pending.push(token);
      continue;
    }
    // Boundary markers arrive as [line-break, marker, line-break]; the marker
    // renders block-level with its own margins, so drop its flanking breaks
    // to avoid double blank lines.
    const flushable = pending.filter(
      (p, j) =>
        !(
          p.isLineBreak &&
          ((j > 0 && isDivider(pending[j - 1])) ||
            (j < pending.length - 1 && isDivider(pending[j + 1])))
        ),
    );
    flushable.forEach((p, j) => pushContext(p, `ctx-${i}-${j}`));
    pending = [];
    parts.push(<span key={`word-${i}`}>{token.raw + (token.attachNext ? "" : " ")}</span>);
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
      <div ref={scrollRef} style={{ maxHeight: "22vh", overflowY: "auto" }}>
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
    </div>
  );
}
