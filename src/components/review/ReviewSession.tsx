import { useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { useReviewSession } from "../../hooks/useReviewSession";
import { useStorage } from "../../data/storageContext";
import { useProfile } from "../../hooks/useProfile";
import { updateStreakOnQualifyingSession } from "../../lib/streak";
import {
  isSessionQualifying,
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
}

export function ReviewSession({ scope, tokens, mode, onChangeMode }: ReviewSessionProps) {
  const { words, currentIndex, accuracy, status, handleKeyPress, reset } = useReviewSession(
    tokens,
    mode,
  );
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();

  const inputRef = useRef<HTMLInputElement>(null);
  // Guards the append-session/streak-update effect below so it fires exactly
  // once per completed session, not once per re-render while status stays
  // "complete". Reset alongside the hook's own reset() on Retry.
  const finalizedRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (status !== "complete" || finalizedRef.current) return;
    // Wait for the profile to have loaded before finalizing — appending the
    // session unconditionally but only *after* profile is available means we
    // never silently skip a streak update just because useProfile's fetch
    // hadn't resolved yet when the last keystroke landed.
    if (!profile) return;
    finalizedRef.current = true;

    const correctKeystrokes = words.filter((w) => w.completed).length;
    const totalKeystrokes = words.reduce(
      (sum, w) => sum + w.attempts + (w.completed ? 1 : 0),
      0,
    );
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
      // attempt.
      await storage.appendReviewSession(session);
      if (isSessionQualifying(session)) {
        const nextStreak = updateStreakOnQualifyingSession(
          profile.streak,
          new Date(session.completedAt),
        );
        await updateProfile({ ...profile, streak: nextStreak });
      }
    })();
  }, [status, profile, words, accuracy, mode, scope, storage, updateProfile]);

  const handleRetry = useCallback(() => {
    reset();
    finalizedRef.current = false;
    startedAtRef.current = new Date().toISOString();
  }, [reset]);

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
        onClick={() => inputRef.current?.focus()}
      >
        {/* Visually hidden but focused/focusable input — drives handleKeyPress
            from onChange rather than a bare document keydown listener, so
            mobile virtual keyboards actually work (spec-review fix #5). */}
        <input
          ref={inputRef}
          value=""
          onChange={handleInputChange}
          aria-label="Type the first letter of each word to advance"
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
          }}
        />
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
            />
          ))}
        </p>
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
          Accuracy: {accuracy}%
        </span>
        <Button variant="ghost" onClick={onChangeMode}>
          Change Mode
        </Button>
      </div>

      {status === "complete" && (
        <SessionSummary
          accuracy={accuracy}
          passed={accuracy >= PASS_THRESHOLD}
          onRetry={handleRetry}
          backTo="/"
        />
      )}
    </div>
  );
}
