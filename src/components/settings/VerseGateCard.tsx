import { useMemo, useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { MODE_OPTIONS } from "../review/ModePicker";
import { useCollections } from "../../hooks/useCollections";
import { useVerses } from "../../hooks/useVerses";

import { useClampedIntDraft } from "../../hooks/useClampedIntDraft";

import { normalizeDomain } from "../../lib/domainWhitelist";
import type { NewTabGateSettings, Settings } from "../../types/settings";
import type { ReviewMode } from "../../types/review";
import { SegmentedControl } from "./SegmentedControl";
import {
  gateLabelStyle,
  gateSelectStyle,
  gateSubsectionStyle,
  helperTextStyle,
  inputStyle,
  sectionTitleStyle,
} from "./styles";

const GATE_TOGGLE_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

// --- Verse Gate (extension new-tab gate) section ---
// Rendered only once settings has loaded, so `settings` is always non-null here
// and every write can safely spread the full object.
export function VerseGateCard({
  settings,
  updateSettings,
}: {
  settings: Settings;
  updateSettings: (next: Settings) => Promise<void>;
}) {
  const gate = settings.newTabGate;
  const { collections, unionVerseIds } = useCollections();
  const { verses } = useVerses();


  const [domainDraft, setDomainDraft] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

  async function updateGate(patch: Partial<NewTabGateSettings>) {
    await updateSettings({ ...settings, newTabGate: { ...gate, ...patch } });
  }

  // Cooldown minutes is a free-typed field: keep a draft so the user can clear
  // and retype, and only commit a valid whole number >= 1 (reverting the draft
  // on anything else). No upper bound. Re-seeded whenever the stored value changes.
  const {
    draft: minutesDraft,
    setDraft: setMinutesDraft,
    commitDraft: commitMinutes,
  } = useClampedIntDraft(
    gate.cooldownMinutes,
    { min: 1, max: Infinity },
    (cooldownMinutes) => updateGate({ cooldownMinutes }),
  );



  // --- Whitelist ---
  function handleAddDomain() {
    const domain = normalizeDomain(domainDraft);
    if (!domain) {
      setDomainError("That doesn’t look like a valid domain (try something like “docs.google.com”).");
      return;
    }
    setDomainError(null);
    setDomainDraft("");
    if (gate.whitelist.includes(domain)) return;
    updateGate({ whitelist: [...gate.whitelist, domain] });
  }

  // --- Verse source ---
  // The deduped union of ids across every selected collection, in a stable
  // order (collection order, then verse order within each). A stored verseIds
  // subset is always intersected with this, so verses later removed from a
  // collection silently drop out of the pool. Memoized — this card also holds
  // controlled text inputs, so it re-renders on every keystroke.
  const collectionVerseIds = useMemo(
    () => unionVerseIds(gate.collectionIds),
    [gate.collectionIds, unionVerseIds],
  );
  const versesById = useMemo(() => new Map(verses.map((v) => [v.id, v])), [verses]);
  const checkedIds = useMemo(
    () => new Set(gate.verseIds ?? collectionVerseIds),
    [gate.verseIds, collectionVerseIds],
  );
  const checkedCount = collectionVerseIds.filter((id) => checkedIds.has(id)).length;



  function toggleVerse(verseId: string) {
    const next = new Set(checkedIds);
    if (next.has(verseId)) {
      next.delete(verseId);
    } else {
      next.add(verseId);
    }
    const subset = collectionVerseIds.filter((id) => next.has(id));
    // null means "the whole collection", so a full selection is stored as null —
    // verses added to the collection later are then included automatically.
    updateGate({ verseIds: subset.length === collectionVerseIds.length ? null : subset });
  }

  // Toggle a collection in/out of the gate's source set. Changing the set of
  // selected collections invalidates any verse subset (it belonged to the old
  // selection), so reset verseIds to null (the whole selection).
  function toggleCollection(collectionId: string) {
    const next = gate.collectionIds.includes(collectionId)
      ? gate.collectionIds.filter((id) => id !== collectionId)
      : [...gate.collectionIds, collectionId];
    updateGate({ collectionIds: next, verseIds: null });
  }

  // --- Warnings ---
  // The gate FAILS OPEN when unconfigured; make that loud.
  let warning: string | null = null;
  if (gate.enabled && gate.collectionIds.length === 0) {
    warning =
      "Gate is on but no collection is selected — navigation will NOT be blocked until you pick one.";
  } else if (
    gate.enabled &&
    gate.collectionIds.length > 0 &&
    gate.verseIds !== null &&
    checkedCount === 0
  ) {
    warning =
      "Gate is on but no verses are selected — navigation will NOT be blocked until you check at least one.";

  }

  return (
    <Card>
      <h3 style={sectionTitleStyle}>Verse Gate</h3>
      <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
        When on, every new tab must complete a verse review before it can load a non-whitelisted
        site. (Only applies in the Chrome extension.)
      </p>
      <SegmentedControl
        ariaLabel="Verse gate"
        options={GATE_TOGGLE_OPTIONS}
        value={gate.enabled}
        onChange={(enabled) => updateGate({ enabled })}
      />
      {warning ? (
        <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", fontWeight: 600, marginTop: "0.75rem" }}>
          {warning}
        </p>
      ) : null}

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Whitelisted domains</span>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <input
            type="text"
            value={domainDraft}
            onChange={(e) => setDomainDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddDomain();
            }}
            placeholder="e.g. docs.google.com"
            autoComplete="off"
            aria-label="Domain to whitelist"
            style={inputStyle}
          />
          <Button type="button" variant="primary" onClick={handleAddDomain} disabled={domainDraft.trim() === ""}>
            Add
          </Button>
        </div>
        {domainError ? (
          <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginBottom: "0.6rem" }}>
            {domainError}
          </p>
        ) : null}
        {gate.whitelist.length > 0 ? (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.6rem" }}>
            {gate.whitelist.map((domain) => (
              <li key={domain} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ flex: 1, fontSize: "0.9rem" }}>{domain}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => updateGate({ whitelist: gate.whitelist.filter((d) => d !== domain) })}
                  aria-label={`Remove ${domain} from whitelist`}
                  style={{ padding: "0.25rem 0.7rem", fontSize: "0.8rem" }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <p style={helperTextStyle}>
          Only these sites load without a review. A domain also matches its subdomains.
        </p>
      </div>

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Verse source</span>
        {/* Multiple collections can feed the gate; their verses are pooled
            (deduped) into one review set. */}
        {collections.length === 0 ? (
          <p style={helperTextStyle}>Create a collection first — the gate draws its verses from one.</p>
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
                  checked={gate.collectionIds.includes(collection.id)}
                  onChange={() => toggleCollection(collection.id)}
                  style={{ accentColor: "var(--color-clay)" }}
                />
                {collection.name}
              </label>
            ))}
          </div>
        )}
        {gate.collectionIds.length > 0 ? (
          <div style={{ marginTop: "0.6rem" }}>
            <button
              type="button"
              onClick={() => setLimitOpen((v) => !v)}
              aria-expanded={limitOpen}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-clay)",
                fontFamily: "inherit",
              }}
            >
              {limitOpen ? "▾" : "▸"} Limit to specific verses
              {gate.verseIds !== null ? ` (${checkedCount} of ${collectionVerseIds.length})` : ""}
            </button>
            {limitOpen ? (
              <div
                style={{
                  marginTop: "0.5rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  padding: "0.6rem 0.75rem",
                  maxHeight: "14rem",
                  overflowY: "auto",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  <input
                    type="checkbox"
                    checked={collectionVerseIds.length > 0 && checkedCount === collectionVerseIds.length}
                    onChange={(e) => updateGate({ verseIds: e.target.checked ? null : [] })}
                    style={{ accentColor: "var(--color-clay)" }}
                  />
                  Select all
                </label>
                {collectionVerseIds.length === 0 ? (
                  <p style={helperTextStyle}>This collection has no verses yet.</p>
                ) : (
                  collectionVerseIds.map((verseId) => (
                    <label
                      key={verseId}
                      style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", padding: "0.15rem 0" }}
                    >
                      <input
                        type="checkbox"
                        checked={checkedIds.has(verseId)}
                        onChange={() => toggleVerse(verseId)}
                        style={{ accentColor: "var(--color-clay)" }}
                      />
                      {versesById.get(verseId)?.reference ?? "(unknown verse)"}
                    </label>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>



      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Verse selection</span>
        <p style={{ ...helperTextStyle, marginBottom: "0.6rem" }}>
          Choose whether the gate prioritizes verses that are due for review under the spaced-repetition schedule (falling back to others when none are due), or quizzes any verse in the selected pool at random.
        </p>
        <SegmentedControl
          ariaLabel="Verse selection"
          options={[
            { value: true, label: "Due first" },
            { value: false, label: "Random (all)" },
          ]}
          value={gate.prioritizeDue !== false}
          onChange={(prioritizeDue) => updateGate({ prioritizeDue })}
        />
      </div>

      <div style={gateSubsectionStyle}>
        <label htmlFor="gate-mode" style={gateLabelStyle}>
          Review mode
        </label>
        <select
          id="gate-mode"
          value={gate.mode}
          onChange={(e) => updateGate({ mode: e.target.value as ReviewMode })}
          style={gateSelectStyle}
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={gateSubsectionStyle}>
        <span style={gateLabelStyle}>Review cooldown</span>
        <p style={{ ...helperTextStyle, marginBottom: "0.6rem" }}>
          When on, completing any verse review (here at the gate or in a normal review or game)
          unlocks browsing for a set time — new tabs load without a review until it runs out. Each
          review you finish restarts the timer. When off, every new tab needs its own review.
        </p>
        <SegmentedControl
          ariaLabel="Review cooldown"
          options={GATE_TOGGLE_OPTIONS}
          value={gate.cooldownEnabled}
          onChange={(cooldownEnabled) => updateGate({ cooldownEnabled })}
        />
        {gate.cooldownEnabled ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={minutesDraft}
              onChange={(e) => setMinutesDraft(e.target.value)}
              onBlur={commitMinutes}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Cooldown duration in minutes"
              style={{ ...inputStyle, flex: undefined, width: "6rem" }}
            />
            <span style={{ fontSize: "0.9rem", color: "var(--color-ink-muted)" }}>
              minutes between reviews
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
