import { useSettings } from "../hooks/useSettings";
import { EsvApiKeySection } from "../components/settings/EsvApiKeySection";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { ReviewInputSection } from "../components/settings/ReviewInputSection";
import { StudyTodayCard } from "../components/settings/StudyTodayCard";
import { VerseGateCard } from "../components/settings/VerseGateCard";
import { DataBackupSection } from "../components/settings/DataBackupSection";

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "36rem", margin: "0 auto" }}>
      <h2 style={{ fontSize: "1.4rem" }}>Settings</h2>

      <EsvApiKeySection settings={settings} updateSettings={updateSettings} />

      <AppearanceSection />

      {settings ? <ReviewInputSection settings={settings} updateSettings={updateSettings} /> : null}

      {settings ? <StudyTodayCard settings={settings} updateSettings={updateSettings} /> : null}

      {settings ? <VerseGateCard settings={settings} updateSettings={updateSettings} /> : null}

      <DataBackupSection />
    </div>
  );
}

