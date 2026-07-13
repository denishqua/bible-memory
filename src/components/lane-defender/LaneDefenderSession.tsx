import { useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { useLaneDefenderSession } from "../../hooks/useLaneDefenderSession";
import { useStorage } from "../../data/storageContext";
import { useProfile } from "../../hooks/useProfile";
import { updateStreakOnQualifyingSession } from "../../lib/streak";
import {
  isSessionQualifying,
  type ReviewSession as ReviewSessionRecord,
  type ReviewScope,
} from "../../types/review";
import { createId } from "../../data/ids";
import type { Token } from "../../lib/tokenize";
import { LANE_KEYS } from "../../lib/laneDefenderEngine";
import { Button } from "../ui/Button";
import { BuiltVerse } from "../review/BuiltVerse";
import { Lane } from "./Lane";
import { LivesDisplay } from "./LivesDisplay";
import { MissionCompleteScreen } from "./MissionCompleteScreen";
import { MissionFailedScreen } from "./MissionFailedScreen";

interface LaneDefenderSessionProps {
  scope: ReviewScope;
  tokens: Token[];
  onChangeMode: () => void;
}

export function LaneDefenderSession({ scope, tokens, onChangeMode }: LaneDefenderSessionProps) {
  const isCollection = scope.type === "collection";
  const {
    lanes,
    livesRemaining,
    status,
    destroyedCount,
    totalWords,
    result,
    handleKey,
    retry,
  } = useLaneDefenderSession(tokens, isCollection);
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();

  const inputRef = useRef<HTMLInputElement>(null);
  // Guards the append-session/streak-update effect below so it fires exactly
  // once per completed session, not once per re-render while status stays
  // terminal. Reset alongside the hook's own retry() on Retry.
  const finalizedRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());

  // Focus on mount AND whenever a retry flips status back to "playing" — the
  // input is only mounted while playing, so a focus() call inside handleRetry
  // would run before the input has remounted and silently do nothing.
  useEffect(() => {
    if (status === "playing") inputRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (status === "playing" || finalizedRef.current) return;
    // Wait for the profile to have loaded before finalizing — appending the
    // session unconditionally but only *after* profile is available means we
    // never silently skip a streak update just because useProfile's fetch
    // hadn't resolved yet when the run ended.
    if (!profile || !result) return;
    finalizedRef.current = true;

    const session: ReviewSessionRecord = {
      id: createId(),
      scope,
      mode: "lane-defender",
      result: {
        type: "lives",
        livesRemaining: result.livesRemaining,
        totalKeystrokes: result.totalKeystrokes,
        correctKeystrokes: result.correctKeystrokes,
        passed: result.passed,
      },
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
  }, [status, result, profile, scope, storage, updateProfile]);

  const handleRetry = useCallback(() => {
    retry();
    finalizedRef.current = false;
    startedAtRef.current = new Date().toISOString();
    // Refocusing the (remounted) input happens in the status effect above.
  }, [retry]);

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
        <LivesDisplay livesRemaining={livesRemaining} />
        <span style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>
          {destroyedCount} / {totalWords} words
        </span>
        <Button variant="ghost" onClick={onChangeMode}>
          Change Mode
        </Button>
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
                <Lane key={LANE_KEYS[i]} laneKey={LANE_KEYS[i].toUpperCase()} word={word} />
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
            Hitting any other word costs a life.
          </p>
        </>
      )}

      {status === "complete" && result && (
        <MissionCompleteScreen result={result} onRetry={handleRetry} />
      )}
      {status === "failed" && result && (
        <MissionFailedScreen result={result} onRetry={handleRetry} />
      )}

      <BuiltVerse tokens={tokens} completedWords={destroyedCount} />
    </div>
  );
}
