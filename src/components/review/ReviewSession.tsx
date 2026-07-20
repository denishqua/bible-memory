import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { perVerseAccuracy, useReviewSession } from "../../hooks/useReviewSession";
import { useStorage } from "../../data/storageContext";
import { useProfile } from "../../hooks/useProfile";
import { useSettings } from "../../hooks/useSettings";
import {
  type ReviewSession as ReviewSessionRecord,
  type ReviewScope,
  type MaskableReviewMode,
} from "../../types/review";
import { createId } from "../../data/ids";
import type { Token } from "../../lib/tokenize";
import { Button } from "../ui/Button";
import { WordToken } from "./WordToken";
import { SessionSummary } from "./SessionSummary";

const PASS_THRESHOLD = 90;

interface ReviewSessionProps {
  scope: ReviewScope;
  tokens: Token[];
  mode: MaskableReviewMode;
  onChangeMode: () => void;
  // Fired exactly once when the session completes (pass or fail alike).
  // Optional — existing callers omit it; the gate page listens for it.
  onComplete?: () => void;
  // Rendered inside the verse gate, which owns its own chrome: hide the
  // "Change Mode" button and the summary's "Back to Library" link.
  embedded?: boolean;
  // Bulk collection review only: the reviewed verses' references in review
  // order, used to label the per-verse accuracy breakdown. Absent (or length
  // <= 1) → single-verse behavior with one overall percentage, unchanged.
  verseReferences?: string[];
}

export function ReviewSession({ scope, tokens, mode, onChangeMode, onComplete, embedded = false, verseReferences }: ReviewSessionProps) {
  const { settings } = useSettings();
  const requireWholeWord = settings?.typeWholeWord ?? false;
  const { words, currentIndex, accuracy, status, handleKeyPress, reset } = useReviewSession(
    tokens,
    mode,
    requireWholeWord,
  );
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();

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
  // has started at or before currentIndex. At completion currentIndex runs past
  // the end, so this naturally lands on the final verse.
  let currentVerse = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].startIndex <= currentIndex) currentVerse = i;
    else break;
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Guards the append-session/practice-count effect below so it fires exactly
  // once per completed session, not once per re-render while status stays
  // "complete". Reset alongside the hook's own reset() on Retry.
  const finalizedRef = useRef(false);
  // Separate once-per-completion latch for the optional onComplete callback —
  // unlike the finalize effect it must NOT wait on profile, so it can't share
  // finalizedRef. Reset alongside it on Retry.
  const completeNotifiedRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());

  // Hint is pure UI-layer state: which word index has its full text revealed
  // in the ghost style. Never touches the engine — accuracy/keystroke counting
  // are unaffected, and the player still types the first letter to advance.
  const [hintedIndex, setHintedIndex] = useState<number | null>(null);

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

  useEffect(() => {
    if (status !== "complete" || completeNotifiedRef.current) return;
    completeNotifiedRef.current = true;
    onComplete?.();
  }, [status, onComplete]);

  useEffect(() => {
    if (status !== "complete" || finalizedRef.current) return;
    // Wait for the profile to have loaded before finalizing — we read
    // profile.versesPracticed to increment it, and appending only *after*
    // profile is available means we never silently skip the bump just because
    // useProfile's fetch hadn't resolved yet when the last keystroke landed.
    if (!profile) return;
    finalizedRef.current = true;

    // Store the word-based tallies behind accuracy: clean words (no wrong
    // keystroke) over total matchable words, matching the displayed percentage.
    const matchableWords = words.filter((w) => w.token.matchable);
    const totalKeystrokes = matchableWords.length;
    const correctKeystrokes = matchableWords.filter((w) => w.attempts === 0).length;
    const passed = accuracy >= PASS_THRESHOLD;

    const session: ReviewSessionRecord = {
      id: createId(),
      scope,
      mode,
      result: { type: "accuracy", accuracy, totalKeystrokes, correctKeystrokes, passed },
      startedAt: startedAtRef.current,
      completedAt: new Date().toISOString(),
    };

    void (async () => {
      // Logged unconditionally — pass or fail, history should reflect every
      // attempt. Every finished session (this whole bulk review is ONE
      // session) bumps the cumulative practice count by exactly 1.
      // recordLiveReview both logs history and restarts the verse gate's
      // browsing cooldown (a live completion, not an import).
      await storage.recordLiveReview(session);
      await updateProfile({ ...profile, versesPracticed: profile.versesPracticed + 1 });
    })();
  }, [status, profile, words, accuracy, mode, scope, storage, updateProfile]);

  const handleRetry = useCallback(() => {
    reset();
    setHintedIndex(null);
    finalizedRef.current = false;
    completeNotifiedRef.current = false;
    startedAtRef.current = new Date().toISOString();
  }, [reset]);

  const handleHint = useCallback(() => {
    setHintedIndex(currentIndex);
    // Keep the hidden input focused so the very next keystroke still lands.
    inputRef.current?.focus({ preventScroll: true });
  }, [currentIndex]);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const typed = event.target.value;
      // The input is always driven back to "" (controlled), so every
      // character present here was typed since the last change — process
      // each in order rather than assuming only one arrived.
      for (const char of typed) {
        handleKeyPress(char);
      }
    },
    [handleKeyPress],
  );

  return (
    <div>
      <div
        style={{ position: "relative", cursor: "text" }}
        onClick={() => inputRef.current?.focus({ preventScroll: true })}
      >
        {/* Visually hidden but focused/focusable input — drives handleKeyPress
            from onChange rather than a bare document keydown listener, so
            mobile virtual keyboards actually work (spec-review fix #5).
            It overlays only the visible (max-height) words viewport, not the
            full scrolled content — pointerEvents: "none" lets clicks and
            wheel scrolling pass through to the scroll container below, while
            the wrapper's onClick handles focusing. */}
        <input
          ref={inputRef}
          value=""
          onChange={handleInputChange}
          aria-label={
            requireWholeWord
              ? "Type each word, then press space to advance"
              : "Type the first letter of each word to advance"
          }
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={status === "complete"}
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
