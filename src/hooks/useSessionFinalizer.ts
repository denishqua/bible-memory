import { useEffect, useRef } from "react";
import { useStorage } from "./useStorage";
import { useProfile } from "./useProfile";
import { createId } from "../data/ids";
import { getDisplayAccuracy, type ReviewMode, type ReviewResult, type ReviewScope, type ReviewSession } from "../types/review";

interface SessionCompletionSummary {
  accuracy: number;
  passed: boolean;
}

interface UseSessionFinalizerOptions {
  isComplete: boolean;
  scope: ReviewScope;
  mode: ReviewMode;
  result: ReviewResult | null;
  onComplete?: (summary: SessionCompletionSummary) => void;
}

type CompletionStage = "in-progress" | "notified" | "finalized";

interface SessionState {
  startedAt: string;
  stage: CompletionStage;
}

export function useSessionFinalizer({
  isComplete,
  scope,
  mode,
  result,
  onComplete,
}: UseSessionFinalizerOptions) {
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();

  const sessionStateRef = useRef<SessionState>({
    startedAt: new Date().toISOString(),
    stage: "in-progress",
  });

  // Reset session state whenever session restarts (isComplete goes back to false)
  useEffect(() => {
    if (!isComplete) {
      sessionStateRef.current = {
        startedAt: new Date().toISOString(),
        stage: "in-progress",
      };
    }
  }, [isComplete]);

  // Handle completion transitions (notify parent and finalize persistence)
  useEffect(() => {
    if (!isComplete || !result) return;

    if (sessionStateRef.current.stage === "in-progress") {
      sessionStateRef.current.stage = "notified";
      const accuracy = getDisplayAccuracy(result);
      onComplete?.({ accuracy, passed: result.passed });
    }

    if (sessionStateRef.current.stage === "notified" && profile) {
      const startedAt = sessionStateRef.current.startedAt;
      sessionStateRef.current.stage = "finalized";

      const session: ReviewSession = {
        id: createId(),
        scope,
        mode,
        result,
        startedAt,
        completedAt: new Date().toISOString(),
      };

      void (async () => {
        await storage.recordLiveReview(session);
        await updateProfile({ ...profile, versesPracticed: profile.versesPracticed + 1 });
      })();
    }
  }, [isComplete, result, profile, scope, mode, storage, updateProfile, onComplete]);

  const startedAtRef = useRef<string>(sessionStateRef.current.startedAt);
  startedAtRef.current = sessionStateRef.current.startedAt;

  return { startedAtRef };
}

