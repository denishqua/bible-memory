import { Card } from "../ui/Card";
import { SegmentedControl } from "./SegmentedControl";
import { sectionTitleStyle, helperTextStyle } from "./styles";
import { useTheme, type ThemePreference } from "../../hooks/useTheme";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <Card>
      <h3 style={sectionTitleStyle}>Appearance</h3>
      <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
        “System” follows your device’s light/dark preference.
      </p>
      <SegmentedControl
        ariaLabel="Theme"
        options={THEME_OPTIONS}
        value={preference}
        onChange={setPreference}
      />
    </Card>
  );
}
