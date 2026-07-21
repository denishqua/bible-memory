import { useCallback, useEffect, useRef, useState } from "react";
import { perVerseAccuracy, useReviewSession } from "../../hooks/useReviewSession";
import { useSettings } from "../../hooks/useSettings";
import { useSessionFinalizer } from "../../hooks/useSessionFinalizer";
import { useHideReference } from "../../hooks/useHideReference";
import {
  type ReviewResult,
  type ReviewScope,
  type MaskableReviewMode,
} from "../../types/review";
import type { Token } from "../../lib/tokenize";
import { Button } from "../ui/Button";
import { HiddenTypingInput } from "../ui/HiddenTypingInput";
import { WordToken } from "./WordToken";
import { SessionSummary } from "./SessionSummary";

const PASS_THRESHOLD = 90;

interface ReviewSessionProps {
  scope: ReviewScope;
  tokens: Token[];
  mode: MaskableReviewMode;
  onChangeMode: () => void;
  // Fired exactly once when the session completes (pass or fail alike). The
  // outcome (accuracy + pass/fail) lets the Study Today flow apply its SRS
  // transition without racing the async history write. Optional — existing
  // callers omit it or ignore the argument; the gate page listens for it.
  onComplete?: (outcome?: { accuracy: number; passed: boolean }) => void;
  // Rendered inside the verse gate, which owns its own chrome: hide the
  // "Change Mode" button and the summary's "Back to Library" link.
  embedded?: boolean;
  // Bulk collection review only: the reviewed verses' references in review
  // order, used to label the per-verse accuracy breakdown. Absent (or length
  // <= 1) → single-verse behavior with one overall percentage, unchanged.
  verseReferences?: string[];
  // Fired once the player is ~25% through the VERSE portion (see
  // shouldHideReference), so a host that shows the reference in its own chrome
  // (the page heading, the gate) can hide it for the rest of the run — the
  // reference itself is now appended to the token stream and recalled inline.
  // No-op / never fires when the stream carries no appended reference (bulk
  // multi-verse review).
  onHideReference?: (hidden: boolean) => void;
}

export function ReviewSession({ scope, tokens, mode, onChangeMode, onComplete, embedded = false, verseReferences, onHideReference }: ReviewSessionProps) {
  const { settings } = useSettings();
  const requireWholeWord = settings?.typeWholeWord ?? false;
  const { words, currentIndex, accuracy, status, handleKeyPress, reset } = useReviewSession(
    tokens,
    mode,
    requireWholeWord,
  );
  // Bulk review shows an INDIVIDUAL live percentage per verse instead of one
  // overall number. Only when there's genuinely more than one verse — a
  // single-verse collection behaves exactly like single-verse review.
  const isBulk =
    scope.type === "collection" && verseReferences !== undefined && verseReferences.length > 1;
  // Segments recomputed each render off `words` (a cheap O(n) pass, on par with
  // the accuracy filter). Empty for the single-verse path — its display is
  // untouched below.
  const segments = isBulk ? perVerseAccuracy(words) : [];
  const verseLabel = (i: number) => verseReferences?.[i] ?? `Verse ${i + 1}`;
  // Which verse the cursor currently sits in: the last segment whose token span
  // has started at or before currentIndex (segments are ordered by startIndex).
  // At completion currentIndex runs past the end, so this naturally lands on the
  // final verse; falls back to 0 when no segment qualifies (single-verse path,
  // where segments is empty).
  const currentVerse = Math.max(
    0,
    segments.findLastIndex((s) => s.startIndex <= currentIndex),
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The finalize/notify/retry plumbing (once-per-completion onComplete, the
  // wait-for-profile history write + practice-count bump, and the retry reset)
  // lives in useSessionFinalizer. It rebuilds the same "accuracy" ReviewResult
  // this component reports: clean words (no wrong keystroke) over total
  // matchable words, matching the displayed percentage.
  const isComplete = status === "complete";
  const passed = accuracy >= PASS_THRESHOLD;
  const matchableWords = words.filter((w) => w.token.matchable);
  const result: ReviewResult | null = isComplete
    ? {
        type: "accuracy",
        accuracy,
        totalKeystrokes: matchableWords.length,
        correctKeystrokes: matchableWords.filter((w) => w.attempts === 0).length,
        passed,
      }
    : null;
  useSessionFinalizer({ isComplete, scope, mode, result, onComplete });

  // Hint is pure UI-layer state: which word index has its full text revealed
  // in the ghost style. Never touches the engine — accuracy/keystroke counting
  // are unaffected, and the player still types the first letter to advance.
  const [hintedIndex, setHintedIndex] = useState<number | null>(null);

  // The appended reference is now part of the token stream, so completion (all
  // matchable tokens typed) already includes recalling the reference — no
  // separate step. Tell the host to hide its reference chrome once the player is
  // ~25% through the VERSE words (excluding the appended reference themselves).
  const verseMatchable = words.filter((w) => w.token.matchable && !w.token.isReference);
  const completedVerseWords = verseMatchable.filter((w) => w.completed).length;
  const hasReference = words.some((w) => w.token.isReference);
  useHideReference(completedVerseWords, verseMatchable.length, hasReference, onHideReference);

  // Auto-clear the hint once the player advances past the hinted word.
  useEffect(() => {
    setHintedIndex((prev) => (prev !== null && prev !== currentIndex ? null : prev));
  }, [currentIndex]);

  // Focus the hidden input whenever the session is active — on first mount AND
  // when Retry flips status back to "in-progress". The input is disabled at
  // completion, so the browser drops focus; without re-focusing here the first
  // post-Retry keystroke lands nowhere until the player clicks or hits Hint.
  // preventScroll: without it the browser scrolls the (huge, invisible) input's
  // center into view on focus, which for bulk sessions lands the viewport in
  // the empty middle of the overlay — a blank page.
  useEffect(() => {
    if (status === "in-progress") {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [status]);

  // Keep the current word visible inside the scrollable words container.
  // Scrolled manually via scrollTop math (not scrollIntoView) so only the
  // inner container moves — scrollIntoView would also scroll the page body.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>('[data-current="true"]');
    if (!el) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const topInView = elRect.top - containerRect.top;
    const bottomInView = elRect.bottom - containerRect.top;

    // Small margin so we re-center slightly before the word touches an edge.
    const margin = elRect.height;
    const fullyVisible =
      topInView >= margin && bottomInView <= container.clientHeight - margin;
    if (fullyVisible) return;

    // Center the current word in the container, instantly (smooth scrolling
    // lags behind fast typing).
    container.scrollTop +=
      topInView - container.clientHeight / 2 + elRect.height / 2;
  }, [currentIndex]);

  const handleRetry = useCallback(() => {
    reset();
    setHintedIndex(null);
  }, [reset]);

  const handleHint = useCallback(() => {
    setHintedIndex(currentIndex);
    // Keep the hidden input focused so the very next keystroke still lands.
    inputRef.current?.focus({ preventScroll: true });
  }, [currentIndex]);

  return (
    <div>
      <div
        style={{ position: "relative", cursor: "text" }}
        onClick={() => inputRef.current?.focus({ preventScroll: true })}
      >
        {/* Visually hidden but focused/focusable input (spec-review fix #5).
            It overlays only the visible (max-height) words viewport, not the
            full scrolled content — pointerEvents: "none" lets clicks and
            wheel scrolling pass through to the scroll container below, while
            the wrapper's onClick handles focusing. */}
        <HiddenTypingInput
          inputRef={inputRef}
          onChar={handleKeyPress}
          disabled={status === "complete"}
          ariaLabel={
            requireWholeWord
              ? "Type each word, then press space to advance"
              : "Type the first letter of each word to advance"
          }
          style={{ pointerEvents: "none" }}
        />
        {/* Scrollable viewport: bulk sessions can render thousands of words,
            so the words scroll inside this container instead of growing the
            page body by thousands of pixels. */}
        <div ref={scrollRef} style={{ maxHeight: "55vh", overflowY: "auto" }}>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.15rem",
              lineHeight: 2,
              whiteSpace: "pre-wrap",
            }}
          >
            {words.map((word, i) => (
              <WordToken
                key={`${word.index}-${word.attempts}`}
                word={word}
                isCurrent={i === currentIndex}
                isHinted={i === currentIndex && hintedIndex === currentIndex}
                wholeWord={requireWholeWord}
              />
            ))}
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>
          {isBulk ? (
            <>
              {verseLabel(currentVerse)} — {segments[currentVerse]?.accuracy ?? 100}%
            </>
          ) : (
            <>Accuracy: {accuracy}%</>
          )}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Disabled in Type It (every word is already fully visible, so a
              hint would be a no-op) and once a hint is already showing. */}
          <Button
            variant="ghost"
            onClick={handleHint}
            disabled={mode === "type-it" || hintedIndex === currentIndex || status === "complete"}
          >
            Hint
          </Button>
          {!embedded && (
            <Button variant="ghost" onClick={handleRetry} disabled={status === "complete"}>
              Restart
            </Button>
          )}
          {!embedded && (
            <Button variant="ghost" onClick={onChangeMode}>
              Change Mode
            </Button>
          )}
        </div>
      </div>

      {status === "complete" && (
        <SessionSummary
          accuracy={accuracy}
          passed={accuracy >= PASS_THRESHOLD}
          onRetry={handleRetry}
          backTo={embedded ? null : "/"}
          perVerse={
            isBulk
              ? segments.map((s, i) => ({ reference: verseLabel(i), accuracy: s.accuracy }))
              : undefined
          }
        />
      )}
    </div>
  );
}
