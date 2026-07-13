import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../hooks/useSettings";
import { useVerses } from "../hooks/useVerses";
import { useCollections } from "../hooks/useCollections";
import { tokenize } from "../lib/tokenize";
import { renderSession } from "../components/review/renderSession";
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
  const { verses, loading: versesLoading } = useVerses();
  const { loading: collectionsLoading, getVerseIdsForCollection } = useCollections();
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

  const loading = settingsLoading || versesLoading || collectionsLoading;
  const gate = settings?.newTabGate;

  // The verse pool: the configured collection's verses (in collection order),
  // narrowed to the selected subset when one is set, keeping only verses that
  // still exist. Empty when the gate is unconfigured.
  const pool = useMemo<Verse[]>(() => {
    if (!gate?.collectionId) return [];
    const byId = new Map(verses.map((v) => [v.id, v] as const));
    let ids = getVerseIdsForCollection(gate.collectionId);
    if (gate.verseIds !== null) {
      const wanted = new Set(gate.verseIds);
      ids = ids.filter((id) => wanted.has(id));
    }
    return ids.map((id) => byId.get(id)).filter((v): v is Verse => v !== undefined);
  }, [gate, verses, getVerseIdsForCollection]);

  const [currentVerseId, setCurrentVerseId] = useState<string | null>(null);
  // Bumped on every Skip; part of the session's React key so a skip fully
  // remounts (and thereby resets) the review session.
  const [attempt, setAttempt] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Pick the initial random verse once the pool has loaded. Guarded so later
  // pool identity churn (storage refreshes) never swaps the verse mid-review.
  useEffect(() => {
    if (loading || pool.length === 0) return;
    setCurrentVerseId((prev) =>
      prev !== null && pool.some((v) => v.id === prev)
        ? prev
        : (pickRandomVerse(pool, null)?.id ?? null),
    );
  }, [loading, pool]);

  const currentVerse = currentVerseId ? pool.find((v) => v.id === currentVerseId) : undefined;

  const { tokens, scope } = useMemo<{ tokens: ReturnType<typeof tokenize>; scope: ReviewScope | null }>(
    () =>
      currentVerse
        ? {
            tokens: tokenize(currentVerse.text),
            scope: { type: "verse", verseId: currentVerse.id },
          }
        : { tokens: [], scope: null },
    [currentVerse],
  );

  const handleSkip = useCallback(() => {
    const next = pickRandomVerse(pool, currentVerseId);
    if (!next) return;
    setCurrentVerseId(next.id);
    setAttempt((n) => n + 1);
    setCompleted(false);
  }, [pool, currentVerseId]);

  const handleComplete = useCallback(() => {
    setCompleted(true);
  }, []);

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

  if (loading) {
    return (
      <p style={{ textAlign: "center", color: "var(--color-ink-muted)" }}>Loading…</p>
    );
  }

  // FAIL-OPEN: any state where a review can't be shown (gate disabled, no
  // collection picked, pool filtered down to nothing, verse not resolvable)
  // offers Proceed immediately rather than trapping the user.
  const failOpenReason = !gate?.enabled
    ? "The verse gate is turned off."
    : !gate.collectionId
      ? "No collection is set up for the verse gate yet."
      : pool.length === 0
        ? "The verse gate's collection has no verses to review."
        : !currentVerse || !scope
          ? "Couldn't load a verse to review."
          : null;

  const proceedButton = (
    <Button variant="primary" onClick={handleProceed} style={{ fontSize: "1rem", padding: "0.65rem 1.5rem" }}>
      {targetUrl ? "Proceed to site →" : "Done"}
    </Button>
  );

  return (
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
      {failOpenReason !== null ? (
        <div style={{ margin: "auto", textAlign: "center" }}>
          <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.25rem" }}>
            {failOpenReason}
          </p>
          {proceedButton}
          {targetHost && (
            <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem", marginTop: "0.6rem" }}>
              {targetHost}
            </p>
          )}
        </div>
      ) : (
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
              {currentVerse!.reference}
            </span>
            <Button variant="ghost" onClick={handleSkip} disabled={pool.length < 2}>
              Skip verse →
            </Button>
          </div>

          {/* Keyed on verse + attempt so Skip fully remounts the session (its
              engine state lives in hooks inside the session component). */}
          <div key={`${currentVerse!.id}-${attempt}`}>
            {renderSession(gate!.mode, scope!, tokens, () => {}, handleComplete, true)}
          </div>

          {completed && (
            <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
              {proceedButton}
              {targetHost && (
                <p
                  style={{
                    color: "var(--color-ink-muted)",
                    fontSize: "0.85rem",
                    marginTop: "0.6rem",
                  }}
                >
                  {targetHost}
                </p>
              )}
            </div>
          )}
        </>
      )}

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
}
