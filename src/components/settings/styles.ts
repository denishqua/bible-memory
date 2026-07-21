// Shared inline styles for the Settings page and its extracted cards
// (StudyTodayCard, VerseGateCard). Kept in one place so the extracted components
// import a single definition instead of duplicating it.

export const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  marginBottom: "0.35rem",
};

export const helperTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--color-ink-muted)",
  lineHeight: 1.5,
};

export const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "0.6rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontFamily: "inherit",
  fontSize: "0.95rem",
};

export const gateSubsectionStyle: React.CSSProperties = {
  marginTop: "1.25rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--color-border)",
};

export const gateLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.9rem",
  fontWeight: 600,
  marginBottom: "0.4rem",
};

export const gateSelectStyle: React.CSSProperties = {
  ...inputStyle,
  flex: undefined,
  width: "100%",
  cursor: "pointer",
};
