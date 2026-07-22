// Consolidated form and card design system styles used across the app.
import type React from "react";

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontFamily: "inherit",
  fontSize: "0.95rem",
};

export const inputFlexStyle: React.CSSProperties = {
  ...inputStyle,
  flex: 1,
  width: undefined,
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.35rem",
  fontSize: "0.85rem",
  color: "var(--color-ink-muted)",
};

export const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  marginBottom: "0.35rem",
};

export const helperTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--color-ink-muted)",
  lineHeight: 1.5,
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
  width: "100%",
  cursor: "pointer",
};

