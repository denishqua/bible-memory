import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useVerseDefenderSession } from "../../hooks/useVerseDefenderSession";
import { useStorage } from "../../data/storageContext";
import { useProfile } from "../../hooks/useProfile";
import { updateStreakOnQualifyingSession } from "../../lib/streak";
import {
  isSessionQualifying,
  type ReviewScope,
  type ReviewSession as ReviewSessionRecord,
} from "../../types/review";
import { createId } from "../../data/ids";
import type { Token } from "../../lib/tokenize";
import { Button } from "../ui/Button";
import { BuiltVerse } from "../review/BuiltVerse";
import { AsteroidField } from "./AsteroidField";
import { Asteroid } from "./Asteroid";
import { Cannon } from "./Cannon";
import { LaserBeam } from "./LaserBeam";
import { LivesDisplay } from "./LivesDisplay";
import { BreachOverlay } from "./BreachOverlay";
import { MissionFailedScreen } from "./MissionFailedScreen";
import { MissionCompleteScreen } from "./MissionCompleteScreen";

const RECOIL_DURATION_MS = 150;
// Slightly longer than the longest laser CSS animation (burst: 300ms) so the
// element unmounts only after its one-shot animation has finished.
const LASER_DURATION_MS = 320;

interface VerseDefenderSessionProps {
  scope: ReviewScope;
  tokens: Token[];
  onChangeMode: () => void;
  // Fired exactly once when the mission ends (complete or failed alike).
  // Optional — existing callers omit it; the gate page listens for it.
  onComplete?: () => void;
  // Rendered inside the verse gate: hide the "Change Mode" button and the
  // mission screen's "Back to Library" link (the gate owns its own exit).
  embedded?: boolean;
}

// Top-level orchestrator for the Verse Defender arcade mode: wires the
// engine-backed hook to the presentational pieces, owns the hidden
// always-focused input (mobile virtual-keyboard reliability — same idiom as
// ReviewSession.tsx), and finalizes the session record exactly once whether
// the mission completes or fails.
export function VerseDefenderSession({
  scope,
  tokens,
  onChangeMode,
  onComplete,
  embedded = false,
}: VerseDefenderSessionProps) {
  const {
    status,
    currentWord,
    currentWordIndex,
    totalWords,
    progress,
    phase,
    livesRemaining,
    correctKeystrokes,
    lastHit,
    result,
    handleKeyPress,
    retry,
  } = useVerseDefenderSession(tokens, scope.type === "collection");
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();

  const inputRef = useRef<HTMLInputElement>(null);
  // Guards the append-session/streak-update effect below so it fires exactly
  // once per completed session, not once per re-render while status stays
  // terminal. Reset alongside the hook's own retry() on Retry.
  const finalizedRef = useRef(false);
  // Separate once-per-completion latch for the optional onComplete callback —
  // unlike the finalize effect it must NOT wait on profile, so it can't share
  // finalizedRef. Reset alongside it on Retry.
  const completeNotifiedRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());

  // Brief cosmetic cannon recoil on every correct hit.
  const [recoiling, setRecoiling] = useState(false);
  // Hint is pure UI-layer state: while active, the asteroid (and the breach
  // overlay, if shown) display the current word's full text in a ghost style.
  // Never touches the engine — the player still fires the first letter, and
  // accuracy/lives are unaffected.
  const [hintActive, setHintActive] = useState(false);
  // The in-flight laser effect; mirrors lastHit while its animation plays,
  // then clears so the one-shot element unmounts.
  const [laser, setLaser] = useState<typeof lastHit>(null);

  const isDone = status === "complete" || status === "failed";

  // Focus on mount AND whenever play (re)starts. The hidden input is unmounted
  // while an end screen is shown, so a plain mount-only effect (or calling
  // focus() synchronously inside handleRetry, when the ref is still null)
  // would leave the keyboard dead after Retry.
  useEffect(() => {
    if (!isDone) inputRef.current?.focus();
  }, [isDone]);

  // Auto-clear the hint when the player advances to the next word.
  useEffect(() => {
    setHintActive(false);
  }, [currentWordIndex]);

  useEffect(() => {
    if (correctKeystrokes === 0) return;
    setRecoiling(true);
    const timer = setTimeout(() => setRecoiling(false), RECOIL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [correctKeystrokes]);

  useEffect(() => {
    if (lastHit === null) return;
    setLaser(lastHit);
    const timer = setTimeout(() => setLaser(null), LASER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [lastHit]);

  useEffect(() => {
    if (result === null || completeNotifiedRef.current) return;
    completeNotifiedRef.current = true;
    onComplete?.();
  }, [result, onComplete]);

  useEffect(() => {
    if (result === null || finalizedRef.current) return;
    // Wait for the profile to have loaded before finalizing — appending the
    // session unconditionally but only *after* profile is available means we
    // never silently skip a streak update just because useProfile's fetch
    // hadn't resolved yet when the session ended.
    if (!profile) return;
    finalizedRef.current = true;

    const session: ReviewSessionRecord = {
      id: createId(),
      scope,
      mode: "verse-defender",
      result,
      startedAt: startedAtRef.current,
      completedAt: new Date().toISOString(),
    };

    void (async () => {
      // Logged unconditionally — mission complete or failed, history should
      // reflect every attempt.
      await storage.appendReviewSession(session);
      if (isSessionQualifying(session)) {
        const nextStreak = updateStreakOnQualifyingSession(
          profile.streak,
          new Date(session.completedAt),
        );
        await updateProfile({ ...profile, streak: nextStreak });
      }
    })();
  }, [result, profile, scope, storage, updateProfile]);

  const handleRetry = useCallback(() => {
    retry();
    setHintActive(false);
    finalizedRef.current = false;
    completeNotifiedRef.current = false;
    startedAtRef.current = new Date().toISOString();
    inputRef.current?.focus();
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
        handleKeyPress(char);
      }
    },
    [handleKeyPress],
  );

  return (
    <div>
      <div
        style={{
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <LivesDisplay livesRemaining={livesRemaining} />
        <span style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>
          Word {Math.min(currentWordIndex + 1, totalWords)} of {totalWords}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Button variant="ghost" onClick={handleHint} disabled={hintActive || isDone}>
            Hint
          </Button>
          {!embedded && (
            <Button variant="ghost" onClick={onChangeMode}>
              Change Mode
            </Button>
          )}
        </div>
      </div>

      {isDone && result !== null ? (
        status === "failed" ? (
          <MissionFailedScreen result={result} onRetry={handleRetry} backTo={embedded ? null : "/"} />
        ) : (
          <MissionCompleteScreen result={result} onRetry={handleRetry} backTo={embedded ? null : "/"} />
        )
      ) : (
        <div
          style={{ position: "relative", cursor: "text" }}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Visually hidden but focused/focusable input — drives handleKeyPress
              from onChange rather than a bare document keydown listener, so
              mobile virtual keyboards actually work (same idiom as
              ReviewSession.tsx). Sits above the field; BreachOverlay is
              pointer-events: none so clicks always land here. */}
          <input
            ref={inputRef}
            value=""
            onChange={handleInputChange}
            aria-label="Type the first letter of the falling word to destroy it"
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
          <AsteroidField phase={phase}>
            {currentWord !== null && (
              <Asteroid
                word={currentWord}
                progress={progress}
                phase={phase}
                breached={status === "breach-paused"}
                hinted={hintActive}
              />
            )}
            {laser !== null && <LaserBeam key={laser.id} hitProgress={laser.progress} />}
            <Cannon phase={phase} recoiling={recoiling} />
            {status === "breach-paused" && currentWord !== null && (
              <BreachOverlay
                word={currentWord}
                livesRemaining={livesRemaining}
                outOfLives={livesRemaining === 0}
                hinted={hintActive}
              />
            )}
          </AsteroidField>
        </div>
      )}

      <BuiltVerse tokens={tokens} completedWords={currentWordIndex} />
    </div>
  );
}
