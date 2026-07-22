import { useState, useEffect } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { sectionTitleStyle, helperTextStyle, inputStyle } from "./styles";
import type { Settings } from "../../types/settings";

interface EsvApiKeySectionProps {
  settings: Settings | null;
  updateSettings: (next: Settings) => Promise<void>;
}

export function EsvApiKeySection({ settings, updateSettings }: EsvApiKeySectionProps) {
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    if (settings) setKeyDraft(settings.esvApiKey);
  }, [settings]);

  useEffect(() => {
    if (!keySaved) return;
    const timer = window.setTimeout(() => setKeySaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [keySaved]);

  const savedKey = settings?.esvApiKey ?? "";

  async function saveKey(value: string) {
    if (!settings) return;
    await updateSettings({ ...settings, esvApiKey: value.trim() });
    setKeySaved(true);
  }

  const keyStatus = savedKey
    ? "Using your saved key."
    : "No key set — ESV lookup is unavailable until you add one.";

  return (
    <Card>
      <h3 style={sectionTitleStyle}>ESV API Key</h3>
      <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
        Required for “Look Up (ESV)” when adding a verse — bring your own key. Get a free API
        token at{" "}
        <a href="https://api.esv.org/" target="_blank" rel="noreferrer" style={{ color: "var(--color-clay)" }}>
          api.esv.org
        </a>
        . Without a key you can still add verses manually.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <input
          id="esv-api-key"
          type={showKey ? "text" : "password"}
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="Paste your ESV API token"
          autoComplete="off"
          aria-label="ESV API key"
          style={inputStyle}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowKey((v) => !v)}
          aria-label={showKey ? "Hide API key" : "Show API key"}
        >
          {showKey ? "Hide" : "Show"}
        </Button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <Button
          type="button"
          variant="primary"
          onClick={() => saveKey(keyDraft)}
          disabled={!settings || keyDraft.trim() === savedKey}
        >
          Save Key
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => saveKey("")}
          disabled={!settings || (savedKey === "" && keyDraft.trim() === "")}
        >
          Clear key
        </Button>
        {keySaved ? (
          <span style={{ color: "var(--color-sage)", fontSize: "0.85rem" }}>Saved</span>
        ) : null}
      </div>
      <p style={{ ...helperTextStyle, marginTop: "0.75rem" }}>{keyStatus}</p>
    </Card>
  );
}
