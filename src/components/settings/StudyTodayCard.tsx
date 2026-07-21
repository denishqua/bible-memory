import { Card } from "../ui/Card";
import { useCollections } from "../../hooks/useCollections";
import type { SchedulerSettings, Settings } from "../../types/settings";
import type { OnFailBehavior } from "../../lib/srs";
import { SegmentedControl } from "./SegmentedControl";
import {
  gateLabelStyle,
  gateSubsectionStyle,
  helperTextStyle,
  sectionTitleStyle,
} from "./styles";

const ON_FAIL_OPTIONS: { value: OnFailBehavior; label: string }[] = [
  { value: "demote", label: "Ease off one step" },
  { value: "hold", label: "Do nothing" },
];

// --- Study Today (spaced-repetition scheduler) section ---
// Rendered only once settings has loaded, so `settings` is always non-null here
// and every write can safely spread the full object.
export function StudyTodayCard({
  settings,
  updateSettings,
}: {
  settings: Settings;
  updateSettings: (next: Settings) => Promise<void>;
}) {
  const scheduler = settings.scheduler;
  const { collections } = useCollections();

  async function updateScheduler(patch: Partial<SchedulerSettings>) {
    await updateSettings({ ...settings, scheduler: { ...scheduler, ...patch } });
  }

  // null = the whole library. Toggling collections builds an array; clearing the
  // last one reverts to null (whole library) rather than an empty pool.
  function toggleCollection(collectionId: string) {
    const current = scheduler.collectionIds ?? [];
    const next = current.includes(collectionId)
      ? current.filter((id) => id !== collectionId)
      : [...current, collectionId];
    updateScheduler({ collectionIds: next.length === 0 ? null : next });
  }

  const selected = scheduler.collectionIds;

  return (
    <Card>
      <h3 style={sectionTitleStyle}>Study Today</h3>
      <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
        Your spaced-repetition review queue: verses due for review, each in an auto-picked mode
        (Type It → Memorize It → Master It). New verses join the schedule when you first review
        them from the Library.
      </p>

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>On a miss</span>
        <p style={{ ...helperTextStyle, marginBottom: "0.6rem" }}>
          What happens to a verse's schedule when you score below 85%. It never resets to the start —
          the harshest option only eases off a single step.
        </p>
        <SegmentedControl
          ariaLabel="On-miss behavior"
          options={ON_FAIL_OPTIONS}
          value={scheduler.onFailBehavior}
          onChange={(onFailBehavior) => updateScheduler({ onFailBehavior })}
        />
      </div>

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Limit to collections</span>
        <p style={{ ...helperTextStyle, marginBottom: "0.6rem" }}>
          {selected === null
            ? "Studying your whole library. Select one or more collections to narrow the pool."
            : "Only verses in the selected collections are studied."}
        </p>
        {collections.length === 0 ? (
          <p style={helperTextStyle}>No collections yet — create one to scope your study pool.</p>
        ) : (
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
              padding: "0.6rem 0.75rem",
              maxHeight: "14rem",
              overflowY: "auto",
            }}
          >
            {collections.map((collection) => (
              <label
                key={collection.id}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", padding: "0.15rem 0" }}
              >
                <input
                  type="checkbox"
                  checked={selected !== null && selected.includes(collection.id)}
                  onChange={() => toggleCollection(collection.id)}
                  style={{ accentColor: "var(--color-clay)" }}
                />
                {collection.name}
              </label>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
