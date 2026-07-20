import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLaneDefenderSession } from "../../hooks/useLaneDefenderSession";
import { useStorage } from "../../data/storageContext";
import { useProfile } from "../../hooks/useProfile";
import {
  type ReviewSession as ReviewSessionRecord,
  type ReviewScope,
} from "../../types/review";
import { createId } from "../../data/ids";
import type { Token } from "../../lib/tokenize";
import { LANE_KEYS } from "../../lib/laneDefenderEngine";
import { mergeReferenceNumbers, shouldHideReference } from "../../lib/verseReview";
import { Button } from "../ui/Button";
import { BuiltVerse } from "../review/BuiltVerse";
import { Lane } from "./Lane";
import { MissionCompleteScreen } from "./MissionCompleteScreen";

interface LaneDefenderSessionProps {
  scope: ReviewScope;
  tokens: Token[];
  onChangeMode: () => void;
  // Fired exactly once when the run ends (complete or failed alike).
  // Optional — existing callers omit it; the gate page listens for it.
  onComplete?: () => void;
  // Rendered inside the verse gate: hide the "Change Mode" button and the
  // mission screen's "Back to Library" link (the gate owns its own exit).
  embedded?: boolean;
  // Fired once the player is ~25% through the verse words, so a host (page
  // heading / gate) can hide the reference. The reference itself is appended to
  // `tokens` (buildVerseReviewTokens) and streams into the lanes as ordinary
  // falling words after the verse.
  onHideReference?: (hidden: boolean) => void;
}

export function LaneDefenderSession({
  scope,
  tokens,
  onChangeMode,
  onComplete,
  embedded = false,
  onHideReference,
}: LaneDefenderSessionProps) {
  // Play each reference number as one target (16, 12, 15) rather than per-digit.
  // Memoized so a host re-render (e.g. the ~25% reference-hide) doesn't hand the
  // engine hook a new array reference and restart the run.
  const gameTokens = useMemo(() => mergeReferenceNumbers(tokens), [tokens]);
  const {
    lanes,
    status,
    destroyedCount,
    totalWords,
    nextTargetWord,
    result,
    lastShot,
    handleKey,
    retry,
  } = useLaneDefenderSession(gameTokens);
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();

  const inputRef = useRef<HTMLInputElement>(null);
  // Guards the append-session/practice-count effect below so it fires exactly
  // once per completed session, not once per re-render while status stays
  // terminal. Reset alongside the hook's own retry() on Retry.
  const finalizedRef = useRef(false);
  // Separate once-per-completion latch for the optional onComplete callback —
  // unlike the finalize effect it must NOT wait on profile, so it can't share
  // finalizedRef. Reset alongside it on Retry.
  const completeNotifiedRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());

  // Hint is pure UI-layer state: while active, a chip in the header shows the
  // verse's next target word. It never highlights the lane — spotting which
  // lane holds the word (and firing D/F/J/K) is still the player's job.
  // Never touches the engine — accuracy/lives are unaffected.
  const [hintActive, setHintActive] = useState(false);

  // The run is terminal — drives onComplete. The reference is appended to the
  // queue, so a completed run has already streamed it through the lanes.
  const sessionFullyDone = status !== "playing" && !!result;

  // Hide the host's reference chrome once ~25% of the VERSE words (excluding the
  // appended reference words) are destroyed. destroyedCount is the in-order
  // count of cleared words and the verse words come first, so it doubles as the
  // completed-verse-word count for this threshold.
  const verseMatchableCount = gameTokens.filter((t) => t.matchable && !t.isReference).length;
  const hasReference = gameTokens.some((t) => t.isReference);
  const hideReference =
    hasReference && shouldHideReference(verseMatchableCount, destroyedCount);

  // Auto-clear the hint once the player destroys the hinted target word.
  useEffect(() => {
    setHintActive(false);
  }, [destroyedCount]);

  // Tell the host to hide its own reference chrome once the threshold is crossed.
  useEffect(() => {
    onHideReference?.(hideReference);
    return () => onHideReference?.(false);
  }, [hideReference, onHideReference]);

  // Focus on mount AND whenever a retry flips status back to "playing" — the
  // input is only mounted while playing, so a focus() call inside handleRetry
  // would run before the input has remounted and silently do nothing.
  useEffect(() => {
    if (status === "playing") inputRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (!sessionFullyDone || completeNotifiedRef.current) return;
    completeNotifiedRef.current = true;
    onComplete?.();
  }, [sessionFullyDone, onComplete]);

  useEffect(() => {
    if (status === "playing" || finalizedRef.current) return;
    // Wait for the profile to have loaded before finalizing — we read
    // profile.versesPracticed to increment it, and appending only *after*
    // profile is available means we never silently skip the bump just because
    // useProfile's fetch hadn't resolved yet when the run ended.
    if (!profile || !result) return;
    finalizedRef.current = true;

    const session: ReviewSessionRecord = {
      id: createId(),
      scope,
      mode: "lane-defender",
      result: {
        type: "accuracy",
        accuracy: result.accuracy,
        totalKeystrokes: result.totalWords,
        correctKeystrokes: result.cleanWords,
        passed: result.passed,
      },
      startedAt: startedAtRef.current,
      completedAt: new Date().toISOString(),
    };

    void (async () => {
      // Logged unconditionally — pass or fail, history should reflect every
      // attempt. Every finished run bumps the cumulative practice count by
      // exactly 1. recordLiveReview both logs history and restarts the verse
      // gate's browsing cooldown (a live completion, not an import).
      await storage.recordLiveReview(session);
      await updateProfile({ ...profile, versesPracticed: profile.versesPracticed + 1 });
    })();
  }, [status, result, profile, scope, storage, updateProfile]);

  const handleRetry = useCallback(() => {
    retry();
    setHintActive(false);
    finalizedRef.current = false;
    completeNotifiedRef.current = false;
    startedAtRef.current = new Date().toISOString();
    // Refocusing the (remounted) input happens in the status effect above.
  }, [retry]);

  const handleHint = useCallback(() => {
    setHintActive(true);
    // Keep the hidden input focused so the very next keystroke still lands.
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const typed = event.target.value;
      // The input is always driven back to "" (controlled), so every
      // character present here was typed since the last change — process
      // each in order rather than assuming only one arrived.
      for (const char of typed) {
        handleKey(char);
      }
    },
    [handleKey],
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <span style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>
          {destroyedCount} / {totalWords} words
          {hintActive && nextTargetWord !== null && status === "playing" && (
            <span
              style={{
                marginLeft: "0.6rem",
                padding: "0.1rem 0.5rem",
                border: "1px solid var(--color-border)",
                borderRadius: "999px",
                whiteSpace: "nowrap",
              }}
            >
              Next:{" "}
              <span style={{ fontStyle: "italic", opacity: 0.75 }}>{nextTargetWord}</span>
            </span>
          )}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Button
            variant="ghost"
            onClick={handleHint}
            disabled={hintActive || status !== "playing"}
          >
            Hint
          </Button>
          {!embedded && (
            <Button variant="ghost" onClick={handleRetry} disabled={status !== "playing"}>
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

      {status === "playing" && (
        <>
          <div
            style={{ position: "relative", cursor: "pointer" }}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Visually hidden but focused/focusable input — drives handleKey
                from onChange rather than a bare document keydown listener, so
                mobile virtual keyboards actually work (same idiom as
                ReviewSession.tsx). */}
            <input
              ref={inputRef}
              value=""
              onChange={handleInputChange}
              aria-label="Press D, F, J, or K to shoot the falling word in that lane"
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
                zIndex: 1,
              }}
            />
            <div style={{ display: "flex", gap: "0.6rem", height: "min(420px, 60vh)" }}>
              {lanes.map((word, i) => (
                <Lane
                  key={LANE_KEYS[i]}
                  laneKey={LANE_KEYS[i].toUpperCase()}
                  word={word}
                  shot={lastShot?.laneIndex === i ? lastShot : null}
                />
              ))}
            </div>
          </div>
          <p
            style={{
              marginTop: "0.75rem",
              color: "var(--color-ink-muted)",
              fontSize: "0.85rem",
              textAlign: "center",
            }}
          >
            Shoot the verse&rsquo;s next word before it lands — D, F, J, K fire the four lanes.
            Firing the wrong lane, or letting the target fall past, counts against your score.
          </p>
        </>
      )}

      {status === "complete" && result && (
        <MissionCompleteScreen
          result={result}
          onRetry={handleRetry}
          backTo={embedded ? null : "/"}
        />
      )}

      <BuiltVerse tokens={gameTokens} completedWords={destroyedCount} />
    </div>
  );
}
