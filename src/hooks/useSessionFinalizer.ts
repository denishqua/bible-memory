import { useEffect, useRef } from "react";
import { useStorage } from "../data/storageContext";
import { useProfile } from "./useProfile";
import { createId } from "../data/ids";
import { getDisplayAccuracy, type ReviewMode, type ReviewResult, type ReviewScope, type ReviewSession } from "../types/review";

export interface SessionCompletionSummary {
  accuracy: number;
  passed: boolean;
}

export interface UseSessionFinalizerOptions {
  isComplete: boolean;
  scope: ReviewScope;
  mode: ReviewMode;
  result: ReviewResult | null;
  onComplete?: (summary: SessionCompletionSummary) => void;
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

  const startedAtRef = useRef<string>(new Date().toISOString());
  const completeNotifiedRef = useRef(false);
  const finalizedRef = useRef(false);

  // Restart startedAtRef whenever session resets (when isComplete goes back to false)
  useEffect(() => {
    if (!isComplete) {
      completeNotifiedRef.current = false;
      finalizedRef.current = false;
      startedAtRef.current = new Date().toISOString();
    }
  }, [isComplete]);

  // Notify parent component on completion once
  useEffect(() => {
    if (!isComplete || !result || completeNotifiedRef.current) return;
    completeNotifiedRef.current = true;
    const accuracy = getDisplayAccuracy(result);
    onComplete?.({ accuracy, passed: result.passed });
  }, [isComplete, result, onComplete]);

  // Write session record and increment practice count once profile is ready
  useEffect(() => {
    if (!isComplete || !result || finalizedRef.current || !profile) return;
    finalizedRef.current = true;

    const session: ReviewSession = {
      id: createId(),
      scope,
      mode,
      result,
      startedAt: startedAtRef.current,
      completedAt: new Date().toISOString(),
    };

    void (async () => {
      await storage.recordLiveReview(session);
      await updateProfile({ ...profile, versesPracticed: profile.versesPracticed + 1 });
    })();
  }, [isComplete, result, profile, scope, mode, storage, updateProfile]);

  return { startedAtRef };
}
