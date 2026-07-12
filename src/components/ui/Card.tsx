import type { HTMLAttributes } from "react";

export function Card({ style, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.9rem",
        boxShadow: "var(--shadow-soft)",
        padding: "1.25rem",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
