import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { UserProfile, Verse } from '../types';
import { useProfile } from '../hooks/useProfile';
import { useCollections } from '../hooks/useCollections';
import { useProgress } from '../hooks/useProgress';
import { useVerses } from '../hooks/useVerses';
import { usePracticeSession } from '../hooks/usePracticeSession';
import { profileStore, progressStore } from '../stores';
import { todayISODate } from '../lib/srs';
import { applyPracticeToStreak } from '../lib/streak';
import { checkBadges, type SessionBadgeContext } from '../lib/badges';
import { isCollectionComplete } from '../lib/collectionProgress';
import { buildDueQueueAcrossCollections } from '../lib/reviewQueue';
import { hoursUntilNextHeart } from '../lib/hearts';
import { VerseDisplay } from '../components/practice/VerseDisplay';
import { ComboMeter } from '../components/practice/ComboMeter';
import { HeartsDisplay } from '../components/practice/HeartsDisplay';
import { HintButton } from '../components/practice/HintButton';
import { WordInput } from '../components/practice/WordInput';
import { WordBankTiles } from '../components/practice/WordBankTiles';
import { MultipleChoiceSprint } from '../components/practice/MultipleChoiceSprint';
import { SessionSummary } from '../components/practice/SessionSummary';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface SessionOutcome {
  streakDays: number;
  badgeIds: string[];
}

type PracticeMode = 'word-bank' | 'multiple-choice' | 'first-letter';

/** Mode selection is driven purely by the verse's SRS box level as of session start. */
function practiceModeForBoxLevel(boxLevel: number | undefined): PracticeMode {
  if (boxLevel === undefined || boxLevel <= 0) return 'word-bank';
  if (boxLevel === 1) return 'multiple-choice';
  return 'first-letter';
}

export function PracticePage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();

  const { profile, loading: profileLoading } = useProfile();
  const { collections, collectionsById, loading: collectionsLoading } = useCollections();
  const { progressByVerseId, loading: progressLoading } = useProgress();
  const { versesById, loading: versesLoading } = useVerses();

  const status = usePracticeSession((s) => s.status);
  const queue = usePracticeSession((s) => s.queue);
  const verseIndex = usePracticeSession((s) => s.verseIndex);
  const words = usePracticeSession((s) => s.words);
  const wordIndex = usePracticeSession((s) => s.wordIndex);
  const inputValue = usePracticeSession((s) => s.inputValue);
  const combo = usePracticeSession((s) => s.combo);
  const maxComboSession = usePracticeSession((s) => s.maxComboSession);
  const sessionXp = usePracticeSession((s) => s.sessionXp);
  const heartsRemaining = usePracticeSession((s) => s.heartsRemaining);
  const completedVerses = usePracticeSession((s) => s.completedVerses);
  const flash = usePracticeSession((s) => s.flash);
  const startSession = usePracticeSession((s) => s.startSession);
  const setInputValue = usePracticeSession((s) => s.setInputValue);
  const submitWord = usePracticeSession((s) => s.submitWord);
  const resetSession = usePracticeSession((s) => s.reset);

  const startedRef = useRef(false);
  const isFirstVerseEverRef = useRef(false);
  const orchestrationRanRef = useRef(false);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);

  const isReviewAll = collectionId === 'review-due';
  const collection = !isReviewAll && collectionId ? collectionsById.get(collectionId) : undefined;
  const loadingData = profileLoading || collectionsLoading || progressLoading || versesLoading;

  useEffect(() => {
    if (startedRef.current) return;
    if (loadingData || (!isReviewAll && !collection) || !profile) return;
    if (profile.hearts <= 0) return;

    startedRef.current = true;

    const today = todayISODate(new Date());
    const dueVerses = isReviewAll
      ? buildDueQueueAcrossCollections(collections, progressByVerseId, versesById, today)
      : collection!.verseIds
          .map((id) => versesById.get(id))
          .filter((v): v is Verse => {
            if (!v) return false;
            const p = progressByVerseId.get(v.id);
            return !!p && p.nextReviewDate <= today;
          });

    isFirstVerseEverRef.current = ![...progressByVerseId.values()].some((p) => p.totalAttempts > 0);

    startSession(dueVerses, profile.hearts);
  }, [loadingData, isReviewAll, collection, collections, profile, versesById, progressByVerseId, startSession]);

  useEffect(() => {
    if (orchestrationRanRef.current) return;
    if (status !== 'session-complete' && status !== 'out-of-hearts') return;
    if (!profile) return;

    orchestrationRanRef.current = true;

    (async () => {
      if (completedVerses.length === 0) {
        setOutcome({ streakDays: profile.currentStreakDays, badgeIds: [] });
        return;
      }

      const now = new Date();
      const startingHearts = profile.hearts;
      const hadFullHeartsBefore = profile.hearts >= profile.heartsMax;
      const heartsLostThisSession = Math.max(0, startingHearts - heartsRemaining);

      const streakPatch = applyPracticeToStreak(profile, now);

      let lastHeartLostAt = profile.lastHeartLostAt;
      if (heartsLostThisSession > 0 && hadFullHeartsBefore) {
        lastHeartLostAt = now.toISOString();
      }

      const patch: Partial<UserProfile> = {
        xp: profile.xp + sessionXp,
        ...streakPatch,
        hearts: heartsRemaining,
        lastHeartLostAt,
      };
      await profileStore.updateProfile(patch);

      const mergedProfile: UserProfile = { ...profile, ...patch };

      const allProgress = await progressStore.getAllProgress();
      const updatedProgressByVerseId = new Map(allProgress.map((p) => [p.verseId, p]));

      const completedVerseIds = new Set(completedVerses.map((cv) => cv.verse.id));
      const justCompletedCollectionIds = collections
        .filter(
          (c) =>
            c.verseIds.some((id) => completedVerseIds.has(id)) &&
            isCollectionComplete(c, updatedProgressByVerseId)
        )
        .map((c) => c.id);

      const ctx: SessionBadgeContext = {
        isFirstVerseEver: isFirstVerseEverRef.current,
        verseCompletedWithNoHints: completedVerses.some((cv) => cv.noHints),
        maxComboThisSession: maxComboSession,
        justCompletedCollectionIds,
      };

      const newBadgeIds = checkBadges(mergedProfile, ctx, allProgress);
      for (const badgeId of newBadgeIds) {
        await profileStore.awardBadge(badgeId);
      }

      setOutcome({ streakDays: streakPatch.currentStreakDays, badgeIds: newBadgeIds });
    })();
  }, [status, profile, completedVerses, sessionXp, heartsRemaining, maxComboSession, collections]);

  function handleDone() {
    resetSession();
    navigate('/');
  }

  if (loadingData || (!isReviewAll && !collection)) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-center text-text-dim">Loading…</p>
      </div>
    );
  }

  if (profile && profile.hearts <= 0 && status === 'idle') {
    const hours = Math.max(1, Math.ceil(hoursUntilNextHeart(profile.lastHeartLostAt, new Date())));
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Card className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold">Out of Hearts</h2>
          <p className="text-sm text-text-dim">
            Come back in about {hours} hour{hours === 1 ? '' : 's'} for your next heart to regenerate.
          </p>
          <Button onClick={() => navigate('/')} className="mt-2 w-full">
            Back Home
          </Button>
        </Card>
      </div>
    );
  }

  if (status === 'session-complete' || status === 'out-of-hearts') {
    if (!outcome) {
      return (
        <div className="mx-auto max-w-2xl p-4">
          <p className="text-center text-text-dim">Saving progress…</p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl p-4">
        <SessionSummary
          sessionXp={sessionXp}
          versesReviewed={completedVerses.length}
          newBadgeIds={outcome.badgeIds}
          streakDays={outcome.streakDays}
          outOfHearts={status === 'out-of-hearts'}
          onDone={handleDone}
        />
      </div>
    );
  }

  const currentVerse = queue[verseIndex];

  if (status !== 'active' || !currentVerse) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-center text-text-dim">Preparing session…</p>
      </div>
    );
  }

  // Box level as captured when the session's due-queue was built (progressByVerseId
  // isn't refetched mid-session), so each verse in a mixed-box-level queue keeps the
  // mode it started with even as this session's own attempts update its progress.
  const mode = practiceModeForBoxLevel(progressByVerseId.get(currentVerse.id)?.boxLevel);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Home
        </Button>
        <HeartsDisplay heartsRemaining={heartsRemaining} heartsMax={profile?.heartsMax ?? heartsRemaining} />
      </div>

      <p className="text-center text-xs uppercase tracking-widest text-text-dim">
        Verse {verseIndex + 1} of {queue.length}
      </p>

      {mode === 'word-bank' && <WordBankTiles key={currentVerse.id} reference={currentVerse.reference} />}
      {mode === 'multiple-choice' && (
        <MultipleChoiceSprint key={currentVerse.id} reference={currentVerse.reference} />
      )}
      {mode === 'first-letter' && (
        <VerseDisplay reference={currentVerse.reference} words={words} currentWordIndex={wordIndex} />
      )}

      <ComboMeter combo={combo} />

      {mode === 'first-letter' && (
        <WordInput value={inputValue} flash={flash} onChange={setInputValue} onSubmit={submitWord} />
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-text-dim">Session XP: {sessionXp}</span>
        {mode === 'first-letter' && <HintButton />}
      </div>
    </div>
  );
}
