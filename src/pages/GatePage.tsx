import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../hooks/useSettings";
import { useVerses } from "../hooks/useVerses";
import { useCollections } from "../hooks/useCollections";
import { useGatePool } from "../hooks/useGatePool";
import { buildVerseReviewTokens } from "../lib/verseReview";
import { renderSession } from "../components/review/renderSession";
import { applyReview } from "../lib/srs";
import { Button } from "../components/ui/Button";
import { GateProceedBlock } from "../components/gate/GateProceedBlock";
import type { ReviewScope } from "../types/review";

const GATE_UNLOCK_MESSAGE_TYPE = "bm-gate-unlock";

export function GatePage() {
  const { settings, loading: settingsLoading } = useSettings();
  const { verses, loading: versesLoading, setSrsState } = useVerses();
  const { loading: collectionsLoading, unionVerseIds } = useCollections();
  const navigate = useNavigate();

  const loading = settingsLoading || versesLoading || collectionsLoading;

  const {
    gate,
    pool,
    targetUrl,
    targetHost,
    currentVerseId,
    completed,
    setCompleted,
    hideReference,
    setHideReference,
    handleSkip,
  } = useGatePool({ settings, verses, unionVerseIds, loading });

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

  const processedRef = useRef<Set<string>>(new Set());

  const handleComplete = useCallback(
    (outcome?: { accuracy: number; passed: boolean }) => {
      setCompleted(true);
      if (!outcome || !currentVerse) return;
      if (gate?.mode === "reference-it") return;
      if (processedRef.current.has(currentVerse.id)) return;
      processedRef.current.add(currentVerse.id);
      const srs = applyReview(currentVerse, outcome.accuracy, new Date().toISOString());
      void setSrsState(currentVerse.id, srs);
    },
    [currentVerse, gate?.mode, setSrsState, setCompleted],
  );

  const handleProceed = useCallback(() => {
    if (!targetUrl) {
      navigate("/");
      return;
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      chrome.runtime.sendMessage({ type: GATE_UNLOCK_MESSAGE_TYPE, targetUrl });
    } else {
      window.location.href = targetUrl;
    }
  }, [targetUrl, navigate]);

  const loadingScreen = (
    <p style={{ textAlign: "center", color: "var(--color-ink-muted)" }}>Loading…</p>
  );

  if (loading) return loadingScreen;

  const proceedBlock = (
    <GateProceedBlock targetUrl={targetUrl} targetHost={targetHost} onProceed={handleProceed} />
  );

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
    return failOpen("The verse gate's collections have no verses to review.");
  }

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

      <div key={currentVerse.id}>
        {renderSession({
          mode: gate.mode,
          scope,
          tokens,
          onChangeMode: () => {},
          onComplete: handleComplete,
          embedded: true,
          onHideReference: setHideReference,
        })}
      </div>

      {completed && (
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>{proceedBlock}</div>
      )}
    </>,
  );
}

