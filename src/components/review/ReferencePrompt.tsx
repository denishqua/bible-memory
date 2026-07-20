import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  matchesReferenceWholeWord,
  referenceFirstLetterSequence,
} from "../../lib/referenceRecall";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

// Result of the "type the reference" recall step. `correct` is whether the
// player produced the reference from memory:
//   • first-letter — true once the whole keystroke sequence is entered (the
//     only way to finish typing it); "Reveal" (giving up) reports false.
//   • whole-word — true iff the typed text matches forgivingly; "Reveal" false.
// Deliberately minimal and DECOUPLED from the stored scoring model — the recall
// outcome is shown to the player but never folded into ReviewResult / verse
// scores (see the session components' finalize effects, which are untouched).
export interface ReferenceRecallResult {
  correct: boolean;
}

interface ReferencePromptProps {
  reference: string;
  // Match the host session's input style: whole-word for the text modes when
  // the typeWholeWord setting is on, first-letter everywhere else (and always
  // for the two arcade modes, which are inherently first-letter).
  wholeWord: boolean;
  // Fired exactly once when the step is finished (recalled, or revealed/given
  // up). The parent then advances to its completion screen.
  onDone: (result: ReferenceRecallResult) => void;
}

// A display segment of the reference for the first-letter prompt: keyable
// segments (a letter-run or a single digit) each consume one keystroke and stay
// masked until cleared; non-keyable segments (spaces/punctuation) render as-is.
// The keyable segments' ordinals line up 1:1 with referenceFirstLetterSequence.
interface RefSegment {
  text: string;
  keyable: boolean;
}

function referenceSegments(reference: string): RefSegment[] {
  const matches = reference.match(/\p{L}+|\p{N}|[^\p{L}\p{N}]+/gu) ?? [];
  return matches.map((text) => ({ text, keyable: /^(\p{L}+|\p{N})$/u.test(text) }));
}

const BLANK_CHAR = "_";

const promptLabelStyle = {
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-ink-muted)",
  marginBottom: "0.5rem",
} as const;

// The recall step, shared by all five modes. Renders inside the same slot the
// completion summary/mission screen occupies, ADDITIVELY: the parent shows it
// after the verse is finished, then swaps to its own summary once onDone fires.
export function ReferencePrompt({ reference, wholeWord, onDone }: ReferencePromptProps) {
  // Fire onDone at most once even if a completion effect and an unmount race.
  const doneRef = useRef(false);
  const finish = (correct: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone({ correct });
  };

  if (wholeWord) {
    return <WholeWordPrompt reference={reference} onFinish={finish} />;
  }
  return <FirstLetterPrompt reference={reference} onFinish={finish} />;
}

// First-letter style: a masked reference the player clears one token at a time,
// driven by the same visually-hidden, always-focused <input> idiom the sessions
// use (mobile virtual keyboards). Auto-completes when the sequence is entered.
function FirstLetterPrompt({
  reference,
  onFinish,
}: {
  reference: string;
  onFinish: (correct: boolean) => void;
}) {
  const sequence = useMemo(() => referenceFirstLetterSequence(reference), [reference]);
  const segments = useMemo(() => referenceSegments(reference), [reference]);
  const [progress, setProgress] = useState(0);
  const [misses, setMisses] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the hidden input the moment the step appears — same requirement the
  // sessions have after Retry (a lost-focus bug was fixed there). This prompt
  // mounts fresh when the step begins, so a mount effect is enough.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Complete once every token is cleared (or there was nothing to type at all).
  useEffect(() => {
    if (!revealed && progress >= sequence.length) {
      onFinish(true);
    }
  }, [progress, sequence.length, revealed, onFinish]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (revealed) return;
    // The input is driven back to "" every change, so process each character
    // that arrived since the last change, in order (same as the sessions).
    let advanced = 0;
    let missed = 0;
    let cursor = progress;
    for (const char of event.target.value) {
      if (char.length !== 1) continue;
      if (cursor >= sequence.length) break;
      if (char.toLowerCase() === sequence[cursor]) {
        cursor += 1;
        advanced += 1;
      } else {
        missed += 1;
      }
    }
    if (advanced > 0) setProgress((p) => p + advanced);
    if (missed > 0) setMisses((m) => m + missed);
  };

  // Ordinal of each keyable segment, so it can be compared against `progress`.
  let keyableOrdinal = -1;

  return (
    <Card style={{ marginTop: "1.5rem" }}>
      <div style={promptLabelStyle}>Now type the reference from memory</div>
      <div
        style={{ position: "relative", cursor: "text" }}
        onClick={() => inputRef.current?.focus({ preventScroll: true })}
      >
        <input
          ref={inputRef}
          value=""
          onChange={handleChange}
          disabled={revealed}
          aria-label="Type the first letter of each part of the reference"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            caretColor: "transparent",
            fontSize: "16px",
            pointerEvents: "none",
          }}
        />
        <p
          className={misses > 0 ? "word-token word-token--flash" : undefined}
          key={misses}
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.6rem",
            letterSpacing: "0.12em",
            color: "var(--color-ink)",
          }}
        >
          {segments.map((segment, i) => {
            if (!segment.keyable) {
              return (
                <span key={i} style={{ color: "var(--color-ink-muted)" }}>
                  {segment.text}
                </span>
              );
            }
            keyableOrdinal += 1;
            const cleared = revealed || keyableOrdinal < progress;
            return (
              <span key={i}>
                {cleared ? segment.text : BLANK_CHAR.repeat(segment.text.length)}
              </span>
            );
          })}
        </p>
      </div>
      <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="ghost"
          onClick={() => {
            setRevealed(true);
            onFinish(false);
          }}
        >
          Reveal
        </Button>
      </div>
    </Card>
  );
}

// Whole-word style: a plain visible field the player types the reference into,
// checked with forgiving matching (case / spaces / punctuation ignored). Unlike
// first-letter, the answer can be wrong — a wrong submit stays put and lets them
// try again or reveal.
function WholeWordPrompt({
  reference,
  onFinish,
}: {
  reference: string;
  onFinish: (correct: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [wrongAttempt, setWrongAttempt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (matchesReferenceWholeWord(value, reference)) {
      onFinish(true);
    } else {
      setWrongAttempt(true);
    }
  };

  return (
    <Card style={{ marginTop: "1.5rem" }}>
      <form onSubmit={handleSubmit}>
        <div style={promptLabelStyle}>Now type the reference from memory</div>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setWrongAttempt(false);
          }}
          aria-label="Type the reference"
          placeholder="e.g. John 3:16"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            width: "100%",
            padding: "0.6rem 0.75rem",
            fontFamily: "var(--font-serif)",
            fontSize: "1.15rem",
            color: "var(--color-ink)",
            background: "var(--color-surface)",
            border: `1px solid ${wrongAttempt ? "var(--color-clay)" : "var(--color-border)"}`,
            borderRadius: "0.5rem",
            outline: "none",
          }}
        />
        {wrongAttempt && (
          <p style={{ color: "var(--color-clay)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Not quite — try again, or reveal it.
          </p>
        )}
        <div
          style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
        >
          <Button type="button" variant="ghost" onClick={() => onFinish(false)}>
            Reveal
          </Button>
          <Button type="submit" variant="primary">
            Check
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Compact recall outcome for the completion screens: reveals the actual
// reference and whether it was recalled. Shared so SessionSummary and both
// arcade mission screens render it identically.
export function ReferenceRecallSummary({
  reference,
  result,
}: {
  reference: string;
  result: ReferenceRecallResult;
}) {
  return (
    <p style={{ fontSize: "0.9rem", color: "var(--color-ink-muted)", marginBottom: "1rem" }}>
      Reference:{" "}
      <span style={{ fontFamily: "var(--font-serif)", color: "var(--color-ink)" }}>
        {reference}
      </span>{" "}
      {result.correct ? "✓ recalled" : "✗ not recalled"}
    </p>
  );
}
