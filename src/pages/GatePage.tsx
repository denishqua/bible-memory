import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../hooks/useSettings";
import { useVerses } from "../hooks/useVerses";
import { useCollections } from "../hooks/useCollections";
import { useReviewHistory } from "../hooks/useReviewHistory";
import { computeVerseScores } from "../lib/verseScore";
import { buildVerseReviewTokens } from "../lib/verseReview";
import { renderSession } from "../components/review/renderSession";
import { applyReview, selectDueFirst } from "../lib/srs";
import { Button } from "../components/ui/Button";
import type { Verse } from "../types/verse";
import type { ReviewScope } from "../types/review";

// Full-screen "verse gate" page the extension's service worker redirects new
// tabs to (index.html?gateTarget=<encoded URL>#/gate). The user reviews one
// random verse from the configured pool; finishing it (pass OR fail — the
// point is engagement, not a score bar) reveals a Proceed button that unlocks
// the tab. Every misconfiguration FAILS OPEN: the gate must never trap a tab.

// The worker reads this exact message type — keep in sync with
// src/extension/background.ts (which cannot import this file).
const GATE_UNLOCK_MESSAGE_TYPE = "bm-gate-unlock";

// The gate only ever forwards to http(s) destinations; anything else
// (javascript:, chrome:, mangled input) is treated as "no target".
function parseTargetUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function pickRandomVerse(pool: Verse[], excludeId: string | null): Verse | null {
  // When skipping, avoid handing back the verse currently on screen (unless
  // it's the only one in the pool).
  const candidates = pool.length > 1 ? pool.filter((v) => v.id !== excludeId) : pool;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function GatePage() {
  const { settings, loading: settingsLoading } = useSettings();
  const { verses, loading: versesLoading, setSrsState } = useVerses();
  const { loading: collectionsLoading, getVerseIdsForCollection } = useCollections();
  const { sessions, loading: historyLoading } = useReviewHistory();
  const navigate = useNavigate();

  // The original destination lives in the real query string (before the
  // hash), so useSearchParams — which reads the hash route's params under
  // HashRouter — can't see it. Read window.location.search directly; it never
  // changes for the lifetime of the page.
  const targetUrl = useMemo(
    () => parseTargetUrl(new URLSearchParams(window.location.search).get("gateTarget")),
    [],
  );
  const targetHost = useMemo(() => (targetUrl ? new URL(targetUrl).hostname : null), [targetUrl]);

  const gate = settings?.newTabGate;
  // Only wait on review history when the mastery filter actually needs it —
  // otherwise the gate would block on a (potentially large) session load on
  // every new tab even though the common case never reads scores.
  const loading =
    settingsLoading ||
    versesLoading ||
    collectionsLoading ||
    Boolean(gate?.masteryFilterEnabled && historyLoading);

  // The verse pool: the union of every selected collection's verses (in
  // collection order, then verse order within each), deduped so a verse in two
  // selected collections appears once, narrowed to the selected subset when one
  // is set, keeping only verses that still exist. Empty when no collection is
  // selected.
  const basePool = useMemo<Verse[]>(() => {
    // Legacy fallback: data stored before the gate supported multiple
    // collections carried a single `collectionId` (no longer in the type, so
    // read it through a widened view).
    const legacyId = (gate as { collectionId?: string | null } | undefined)?.collectionId;
    const collectionIds = gate?.collectionIds ?? (legacyId ? [legacyId] : []);
    if (collectionIds.length === 0) return [];
    const byId = new Map(verses.map((v) => [v.id, v] as const));
    const seen = new Set<string>();
    let ids: string[] = [];
    for (const collectionId of collectionIds) {
      for (const id of getVerseIdsForCollection(collectionId)) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    if (gate?.verseIds != null) {
      const wanted = new Set(gate.verseIds);
      ids = ids.filter((id) => wanted.has(id));
    }
    return ids.map((id) => byId.get(id)).filter((v): v is Verse => v !== undefined);
  }, [gate, verses, getVerseIdsForCollection]);

  // The mastery filter (optional): keep only verses whose mastery score meets
  // the configured threshold. Derived from review history — a verse with no
  // qualifying reviews scores 0. Applied on top of basePool; when off, the pool
  // is basePool unchanged. Fails open downstream if this empties the pool.
  const pool = useMemo<Verse[]>(() => {
    if (!gate?.masteryFilterEnabled) return basePool;
    const threshold = gate.masteryThreshold;
    const scores = computeVerseScores(sessions);
    return basePool.filter((v) => (scores.get(v.id)?.score ?? 0) >= threshold);
  }, [basePool, gate?.masteryFilterEnabled, gate?.masteryThreshold, sessions]);

  const [currentVerseId, setCurrentVerseId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  // Set true once the player is ~25% through the verse — the gate then hides its
  // always-visible reference so the appended reference can't be read off the
  // screen while it's being recalled. onComplete (which reveals Proceed) fires
  // only once the whole stream — verse AND reference — is done, so finishing the
  // gate requires typing the reference too.
  const [hideReference, setHideReference] = useState(false);

  // Pick the initial verse once the pool has loaded — a DUE review first
  // (most-overdue wins), falling back to a random verse when nothing is due.
  // Guarded so later pool identity churn (storage refreshes) never swaps the
  // verse mid-review. `now` is read here (not a dependency) so the pick stays
  // stable across re-renders.
  useEffect(() => {
    if (loading || pool.length === 0) return;
    const now = new Date().toISOString();
    setCurrentVerseId((prev) =>
      prev !== null && pool.some((v) => v.id === prev)
        ? prev
        : ((selectDueFirst(pool, now, null) ?? pickRandomVerse(pool, null))?.id ?? null),
    );
  }, [loading, pool]);

  const currentVerse = currentVerseId ? pool.find((v) => v.id === currentVerseId) : undefined;

  const tokens = useMemo(
    () =>
      currentVerse
        ? buildVerseReviewTokens(currentVerse.text, currentVerse.reference, gate?.mode)
        : [],
    [currentVerse, gate?.mode],
  );
  const scope: ReviewScope | null = currentVerse
    ? { type: "verse", verseId: currentVerse.id }
    : null;

  const handleSkip = useCallback(() => {
    const now = new Date().toISOString();
    const next = selectDueFirst(pool, now, currentVerseId) ?? pickRandomVerse(pool, currentVerseId);
    if (!next) return;
    setCurrentVerseId(next.id);
    setCompleted(false);
    setHideReference(false);
  }, [pool, currentVerseId]);

  // Verse ids whose SRS transition has already been applied this page-load, so
  // Retry (which re-fires onComplete for the same verse) advances the schedule
  // exactly once. Skip moves to a new verse id, which passes this guard.
  const processedRef = useRef<Set<string>>(new Set());

  const handleComplete = useCallback(
    (outcome?: { accuracy: number; passed: boolean }) => {
      // Reveal Proceed immediately — the embedded review session already stamps
      // the browsing cooldown via recordLiveReview when it completes, so there's
      // no need to touch that here.
      setCompleted(true);
      // Advance this verse's SRS schedule once per verse. The cooldown/history
      // path stays untouched (it lives inside the session component). Fire the
      // write async — Proceed doesn't wait on it.
      if (!outcome || !currentVerse) return;
      if (gate?.mode === "reference-it") return;
      if (processedRef.current.has(currentVerse.id)) return;
      processedRef.current.add(currentVerse.id);
      const srs = applyReview(
        currentVerse,
        outcome.accuracy,
        new Date().toISOString(),
        settings?.scheduler.onFailBehavior ?? "demote",
      );
      void setSrsState(currentVerse.id, srs);
    },
    [currentVerse, gate?.mode, settings, setSrsState],
  );

  const handleProceed = useCallback(() => {
    if (!targetUrl) {
      // Opened directly (no gated navigation to resume) — just go home.
      navigate("/");
      return;
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      // Running as the extension page: the worker unlocks this tab and
      // navigates it to the original destination.
      chrome.runtime.sendMessage({ type: GATE_UNLOCK_MESSAGE_TYPE, targetUrl });
    } else {
      // Plain-browser dev fallback: navigate directly.
      window.location.href = targetUrl;
    }
  }, [targetUrl, navigate]);

  const loadingScreen = (
    <p style={{ textAlign: "center", color: "var(--color-ink-muted)" }}>Loading…</p>
  );

  if (loading) return loadingScreen;

  // Proceed button + destination-host caption, shared by the fail-open and
  // completed states.
  const proceedBlock = (
    <>
      <Button variant="primary" onClick={handleProceed} style={{ fontSize: "1rem", padding: "0.65rem 1.5rem" }}>
        {targetUrl ? "Proceed to site →" : "Done"}
      </Button>
      {targetHost && (
        <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem", marginTop: "0.6rem" }}>
          {targetHost}
        </p>
      )}
    </>
  );

  // Shared page chrome: the body plus the settings footer.
  const page = (body: ReactNode) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxWidth: "44rem",
        margin: "0 auto",
        minHeight: "calc(100vh - 3rem)",
        paddingTop: "1.5rem",
      }}
    >
      {body}

      <footer style={{ marginTop: "auto", paddingTop: "2rem", textAlign: "center" }}>
        {/* target=_blank so adjusting settings doesn't lose the gated tab. */}
        <a
          href="#/settings"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem" }}
        >
          Gate settings
        </a>
      </footer>
    </div>
  );

  // FAIL-OPEN: any state where a review can't be shown (gate disabled, no
  // collection picked, pool filtered down to nothing) offers Proceed
  // immediately rather than trapping the user.
  const failOpen = (reason: string) =>
    page(
      <div style={{ margin: "auto", textAlign: "center" }}>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.25rem" }}>{reason}</p>
        {proceedBlock}
      </div>,
    );

  if (!gate?.enabled) return failOpen("The verse gate is turned off.");
  if (gate.collectionIds.length === 0)
    return failOpen("No collection is set up for the verse gate yet.");
  if (pool.length === 0) {
    // Distinguish "nothing selected" from "the mastery filter removed
    // everything" so the fail-open reason points at the real cause.
    if (gate.masteryFilterEnabled && basePool.length > 0)
      return failOpen(
        `No verses in the gate's collections have a mastery score of ${gate.masteryThreshold} or higher yet.`,
      );
    return failOpen("The verse gate's collections have no verses to review.");
  }

  // The pool is ready but the initial random pick (a post-paint effect) hasn't
  // landed yet — keep showing the loading state for that frame rather than
  // flashing the fail-open UI. Not a trap: the pick effect always resolves a
  // verse from a non-empty pool.
  if (!currentVerse || !scope) return loadingScreen;

  return page(
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>
          {hideReference || gate.mode === "reference-it" ? "" : currentVerse.reference}
        </span>
        <Button variant="ghost" onClick={handleSkip} disabled={pool.length < 2}>
          Skip verse →
        </Button>
      </div>

      {/* Keyed on the verse id so Skip fully remounts the session (its engine
          state lives in hooks inside the session component). Skip always
          changes the id: it's disabled when the pool has fewer than 2 verses,
          and pickRandomVerse excludes the current verse otherwise. */}
      <div key={currentVerse.id}>
        {renderSession(
          gate.mode,
          scope,
          tokens,
          () => {},
          handleComplete,
          true,
          undefined,
          setHideReference,
        )}
      </div>

      {completed && (
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>{proceedBlock}</div>
      )}
    </>,
  );
}
