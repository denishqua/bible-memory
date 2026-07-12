import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--color-clay)",
    color: "var(--color-clay-contrast)",
    border: "1px solid transparent",
  },
  secondary: {
    background: "var(--color-sage)",
    color: "var(--color-sage-contrast)",
    border: "1px solid transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-ink)",
    border: "1px solid var(--color-border)",
  },
  danger: {
    background: "transparent",
    color: "var(--color-danger)",
    border: "1px solid var(--color-danger)",
  },
};

export function Button({ variant = "secondary", style, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.4rem",
        fontSize: "0.9rem",
        fontWeight: 500,
        padding: "0.5rem 1rem",
        borderRadius: "0.6rem",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.15s ease, transform 0.05s ease",
        ...VARIANT_STYLES[variant],
        ...style,
      }}
      {...rest}
    />
  );
}
