import { useEffect, useRef, useState, type FormEvent, useMemo } from "react";
import { Button } from "../ui/Button";
import { inputStyle, labelStyle } from "../ui/formStyles";
import { CollectionSelector } from "./CollectionSelector";
import { useCollections } from "../../hooks/useCollections";
import { useCollectionSelection } from "../../hooks/useCollectionSelection";
import { ReviewScheduleEditor } from "./ReviewScheduleEditor";
import { useVerses } from "../../hooks/useVerses";
import { useReviewHistory } from "../../hooks/useReviewHistory";
import { computeVerseScore, verseScoringSessions } from "../../lib/verseScore";
import { getDisplayAccuracy, type ReviewMode } from "../../types/review";
import { scheduleForBucket, dueLabel, frequencyLabel } from "../../lib/srs";
import { ConfirmActionButton } from "../ui/ConfirmActionButton";
import type { EditVerseInput, Verse } from "../../types/verse";

interface EditVerseFormProps {
  verse: Verse;
  onSubmit: (input: EditVerseInput) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

const SCORING_MODE_LABELS: Partial<Record<ReviewMode, string>> = {
  "master-it": "Master It",
  "verse-defender": "Verse Defender",
  "lane-defender": "Lane Defender",
};

export function EditVerseForm({ verse, onSubmit, onCancel, onDelete }: EditVerseFormProps) {
  const {
    collections,
    loading: collectionsLoading,
    createCollection,
    addVerseToCollection,
    removeVerseFromCollection,
    getCollectionsForVerse,
  } = useCollections();

  const { setSrsState } = useVerses();
  const { sessions } = useReviewHistory();

  const [reference, setReference] = useState(verse.reference);
  const [text, setText] = useState(verse.text);
  const [translation, setTranslation] = useState(verse.translation);
  const [submitting, setSubmitting] = useState(false);

  // Collections selection hook
  const { selectedIds, setSelectedIds, toggle, createAndSelect, creating } =
    useCollectionSelection(createCollection);

  // Frequency/Countdown states
  const [frequencySelection, setFrequencySelection] = useState<string>(
    verse.srsBucket !== undefined ? String(verse.srsBucket) : "unscheduled"
  );
  const [restartCountdown, setRestartCountdown] = useState(false);

  // Calculate score and review history list for this verse
  const score = computeVerseScore(sessions, verse.id);
  const history = verseScoringSessions(sessions, verse.id);

  // Seed the checkboxes from the verse's current membership
  const seededRef = useRef(false);
  useEffect(() => {
    if (collectionsLoading || seededRef.current) return;
    seededRef.current = true;
    setSelectedIds(new Set(getCollectionsForVerse(verse.id).map((c) => c.id)));
  }, [collectionsLoading, getCollectionsForVerse, verse.id, setSelectedIds]);

  const canSubmit = reference.trim().length > 0 && text.trim().length > 0 && !submitting;

  // Compute live frequency and due labels based on local edit state
  const tempVerseForLabels = useMemo(() => {
    return {
      ...verse,
      srsBucket: frequencySelection === "unscheduled" ? undefined : Number(frequencySelection),
    };
  }, [verse, frequencySelection]);

  const frequencyText = useMemo(() => {
    return frequencyLabel(tempVerseForLabels);
  }, [tempVerseForLabels]);

  const dueText = useMemo(() => {
    return dueLabel(tempVerseForLabels, new Date());
  }, [tempVerseForLabels]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();

      // 1. Apply collection memberships diff
      const current = new Set(getCollectionsForVerse(verse.id).map((c) => c.id));
      const toAdd = [...selectedIds].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !selectedIds.has(id));
      for (const id of toAdd) await addVerseToCollection(id, verse.id);
      for (const id of toRemove) await removeVerseFromCollection(id, verse.id);

      // 2. Apply review schedule changes
      const currentBucketStr = verse.srsBucket !== undefined ? String(verse.srsBucket) : "unscheduled";
      if (frequencySelection !== currentBucketStr) {
        if (frequencySelection === "unscheduled") {
          await setSrsState(verse.id, { srsBucket: undefined, dueAt: undefined });
        } else {
          const bucket = Number(frequencySelection);
          await setSrsState(verse.id, scheduleForBucket(bucket, now));
        }
      } else if (restartCountdown && frequencySelection !== "unscheduled") {
        await setSrsState(verse.id, scheduleForBucket(Number(frequencySelection), now));
      }

      // 3. Apply reference/text/translation submit
      await onSubmit({
        reference: reference.trim(),
        text: text.trim(),
        translation: translation.trim() || "ESV",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "32rem" }}
    >
      <div>
        <label style={labelStyle} htmlFor="edit-verse-reference">
          Reference
        </label>
        <input
          id="edit-verse-reference"
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="edit-verse-text">
          Text
        </label>
        <textarea
          id="edit-verse-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          style={{ ...inputStyle, fontFamily: "var(--font-serif)", resize: "vertical" }}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="edit-verse-translation">
          Translation
        </label>
        <input
          id="edit-verse-translation"
          type="text"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          style={{ ...inputStyle, maxWidth: "10rem" }}
        />
      </div>
      <CollectionSelector
        collections={collections}
        selectedCollectionIds={selectedIds}
        onToggleCollection={toggle}
        onCreateCollection={createAndSelect}
        creating={creating}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
      />

      <div
        style={{
          borderTop: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
          padding: "1.25rem 0",
          marginTop: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <ReviewScheduleEditor
          frequencyValue={frequencySelection}
          onFrequencyChange={setFrequencySelection}
          restartActive={restartCountdown}
          onRestartToggle={() => setRestartCountdown(!restartCountdown)}
          restartDisabled={frequencySelection === "unscheduled"}
          frequencyText={frequencyText}
          dueText={dueText}
          showNoChangeOption={false}
        />
      </div>

      {/* Score Section */}
      <div
        style={{
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "1.25rem",
          marginBottom: "0.5rem",
        }}
      >
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
            <h4
              style={{
                fontSize: "1rem",
                fontWeight: 500,
                color: "var(--color-ink)",
                marginBottom: "0.15rem",
                fontFamily: "var(--font-serif)",
              }}
            >
              Score
            </h4>
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              maxHeight: "10rem",
              overflowY: "auto",
              paddingRight: "0.5rem",
            }}
          >
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
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {onDelete && (
          <ConfirmActionButton
            onConfirm={onDelete}
            style={{ marginLeft: "auto" }}
          />
        )}
      </div>
    </form>
  );
}
