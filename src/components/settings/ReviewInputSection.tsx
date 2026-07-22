import { Card } from "../ui/Card";
import { SegmentedControl } from "./SegmentedControl";
import { sectionTitleStyle, helperTextStyle } from "./styles";
import type { Settings } from "../../types/settings";

const REVIEW_INPUT_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: "First letter" },
  { value: true, label: "Whole word" },
];

interface ReviewInputSectionProps {
  settings: Settings;
  updateSettings: (next: Settings) => Promise<void>;
}

export function ReviewInputSection({ settings, updateSettings }: ReviewInputSectionProps) {
  return (
    <Card>
      <h3 style={sectionTitleStyle}>Review input</h3>
      <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
        In the Type It / Memorize It / Master It modes, advance by typing just the first letter of
        each word, or the whole word.
      </p>
      <SegmentedControl
        ariaLabel="Review input style"
        options={REVIEW_INPUT_OPTIONS}
        value={settings.typeWholeWord}
        onChange={(value) => updateSettings({ ...settings, typeWholeWord: value })}
      />
    </Card>
  );
}
