import { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import type { Settings } from "../../types/settings";

interface EsvSettingsSectionProps {
  settings: Settings;
  onUpdateKey: (key: string) => Promise<void>;
  onClearKey: () => Promise<void>;
}

export function EsvSettingsSection({ settings, onUpdateKey, onClearKey }: EsvSettingsSectionProps) {
  const [apiKeyInput, setApiKeyInput] = useState(settings.esvApiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSave = async () => {
    await onUpdateKey(apiKeyInput.trim());
    setSavedMessage(apiKeyInput.trim() ? "API key saved." : "API key cleared.");
    setTimeout(() => setSavedMessage(null), 2500);
  };

  const handleClear = async () => {
    setApiKeyInput("");
    await onClearKey();
    setSavedMessage("API key cleared.");
    setTimeout(() => setSavedMessage(null), 2500);
  };

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h2 style={{ fontSize: "1.1rem" }}>ESV API Configuration</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--color-ink-muted)", marginTop: "0.2rem" }}>
          Provide your free ESV API key to search and auto-populate verse text when adding new verses.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Paste your ESV API key here..."
            style={{
              flex: 1,
              padding: "0.6rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              fontFamily: "inherit",
              fontSize: "0.95rem",
            }}
          />
          <Button variant="ghost" onClick={() => setShowKey(!showKey)}>
            {showKey ? "Hide" : "Show"}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Key
          </Button>
          {settings.esvApiKey ? (
            <Button variant="ghost" onClick={handleClear}>
              Clear
            </Button>
          ) : null}
        </div>
        {savedMessage ? (
          <span style={{ fontSize: "0.85rem", color: "var(--color-sage)" }}>{savedMessage}</span>
        ) : null}
      </div>
    </Card>
  );
}
