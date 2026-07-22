import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useVerses } from "../hooks/useVerses";
import type { EditVerseInput } from "../types/verse";
import { useReviewHistory } from "../hooks/useReviewHistory";
import { computeVerseScore, verseScoringSessions } from "../lib/verseScore";
import { dueLabel, frequencyLabel, scheduleForBucket } from "../lib/srs";
import { getDisplayAccuracy, type ReviewMode } from "../types/review";
import { EditVerseForm } from "../components/library/EditVerseForm";
import { ReviewScheduleEditor } from "../components/library/ReviewScheduleEditor";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmActionButton } from "../components/ui/ConfirmActionButton";

const SCORING_MODE_LABELS: Partial<Record<ReviewMode, string>> = {
  "master-it": "Master It",
  "verse-defender": "Verse Defender",
  "lane-defender": "Lane Defender",
};

export function VerseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { verses, loading, updateVerse, setSrsState, deleteVerse } = useVerses();
  const { sessions } = useReviewHistory();
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const verse = verses.find((v) => v.id === id);
  const score = verse ? computeVerseScore(sessions, verse.id) : 0;
  const history = verse ? verseScoringSessions(sessions, verse.id) : [];

  if (loading) {
    return <p style={{ color: "var(--color-ink-muted)" }}>Loading…</p>;
  }

  if (!verse) {
    return (
      <div>
        <p style={{ color: "var(--color-ink-muted)" }}>Verse not found.</p>
        <Link to="/">Back to Library</Link>
      </div>
    );
  }

  async function handleSave(input: EditVerseInput) {
    await updateVerse(verse!.id, input);
    setIsEditing(false);
  }

  async function handleDelete() {
    await deleteVerse(verse!.id);
    navigate("/");
  }

  // Setting a frequency (or restarting the countdown) restarts the schedule from
  // now at the chosen bucket's interval — see scheduleForBucket.
  async function handleFrequencyChange(bucket: number) {
    await setSrsState(verse!.id, scheduleForBucket(bucket, new Date().toISOString()));
  }

  async function handleRestartCountdown() {
    if (verse!.srsBucket === undefined) return;
    await setSrsState(verse!.id, scheduleForBucket(verse!.srsBucket, new Date().toISOString()));
  }

  return (
    <div>
      <Link
        to="/"
        style={{
          display: "inline-block",
          marginBottom: "1.25rem",
          color: "var(--color-ink-muted)",
          fontSize: "0.9rem",
        }}
      >
        ← Back to Library
      </Link>

      {isEditing ? (
        <Card>
          <h2 style={{ marginBottom: "1rem" }}>Edit Verse</h2>
          <EditVerseForm verse={verse} onSubmit={handleSave} onCancel={() => setIsEditing(false)} />
        </Card>
      ) : (
        <Card>
          <h1 style={{ marginBottom: "0.75rem" }}>{verse.reference}</h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.15rem",
              lineHeight: 1.6,
              whiteSpace: "pre-line",
              marginBottom: "0.5rem",
            }}
          >
            {verse.text}
          </p>
          <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            {verse.translation}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <Link to={`/review?verseId=${verse.id}`} style={{ textDecoration: "none" }}>
              <Button variant="primary">Review</Button>
            </Link>
            <Button variant="ghost" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            <ConfirmActionButton onConfirm={handleDelete} />
          </div>
        </Card>
      )}

      {!isEditing && (
        <Card style={{ marginTop: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: history.length > 0 ? "1rem" : 0,
            }}
          >
            <div>
              <h2 style={{ fontSize: "1rem", marginBottom: "0.15rem" }}>Score</h2>
              <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8rem" }}>
                Average of Master It, Verse Defender &amp; Lane Defender reviews
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "2rem",
                  color: history.length > 0 ? "var(--color-ink)" : "var(--color-ink-muted)",
                }}
              >
                {score}
              </span>
              <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8rem" }}>
                {history.length > 0
                  ? `${history.length} review${history.length === 1 ? "" : "s"}`
                  : "No scored reviews yet"}
              </p>
            </div>
          </div>

          {history.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {history.map((session) => (
                <div
                  key={session.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    fontSize: "0.85rem",
                    color: "var(--color-ink-muted)",
                    borderTop: "1px solid var(--color-border)",
                    paddingTop: "0.4rem",
                  }}
                >
                  <span>{SCORING_MODE_LABELS[session.mode] ?? session.mode}</span>
                  <span>{new Date(session.completedAt).toLocaleDateString()}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-ink)" }}>
                    {getDisplayAccuracy(session.result)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {!isEditing && (
        <Card style={{ marginTop: "1.25rem" }}>
          <ReviewScheduleEditor
            frequencyValue={verse.srsBucket !== undefined ? String(verse.srsBucket) : "unscheduled"}
            onFrequencyChange={(val) => {
              if (val === "unscheduled") {
                void setSrsState(verse.id, { srsBucket: undefined, dueAt: undefined });
              } else {
                void handleFrequencyChange(Number(val));
              }
            }}
            restartActive={false}
            onRestartToggle={() => void handleRestartCountdown()}
            restartDisabled={verse.srsBucket === undefined}
            frequencyText={frequencyLabel(verse)}
            dueText={dueLabel(verse, new Date())}
            showNoChangeOption={false}
          />
        </Card>
      )}
    </div>
  );
}
