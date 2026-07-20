import { useId, useState, type ReactNode } from "react";

interface TooltipProps {
  // The text shown in the floating bubble.
  label: string;
  // The trigger — hovering (or focusing, when focusable) it reveals the bubble.
  children: ReactNode;
  // Which side the bubble opens toward. "top" (default) suits mid-page
  // triggers; "bottom" suits triggers pinned near the top edge (the header
  // badge) where there's no room above.
  placement?: "top" | "bottom";
  // Horizontal anchoring relative to the trigger. "end" keeps the bubble from
  // spilling past the right viewport edge for right-aligned triggers.
  align?: "center" | "start" | "end";
  // Whether the trigger is keyboard-focusable (adds a tab stop and shows the
  // tooltip on focus). Default true. Pass false for triggers repeated across a
  // long list (per-row scores) so keyboard users aren't given hundreds of tab
  // stops — the hover tooltip still works, and the meaning is documented once
  // on the focusable column header.
  focusable?: boolean;
}

// A small styled tooltip: appears immediately on hover (and on keyboard focus
// when focusable), themed via the app's CSS variables so it matches light and
// dark. Replaces bare `title` attributes, which only show after an OS delay and
// can't be styled. Positioned with plain absolute layout — no ancestor in the
// app clips overflow, so no portal is needed.
export function Tooltip({
  label,
  children,
  placement = "top",
  align = "center",
  focusable = true,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const vertical =
    placement === "top" ? { bottom: "calc(100% + 0.5rem)" } : { top: "calc(100% + 0.5rem)" };
  const horizontal =
    align === "center"
      ? { left: "50%", transform: "translateX(-50%)" }
      : align === "start"
        ? { left: 0 }
        : { right: 0 };

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={focusable ? () => setOpen(true) : undefined}
      onBlur={focusable ? () => setOpen(false) : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            ...vertical,
            ...horizontal,
            zIndex: 100,
            width: "max-content",
            maxWidth: "16rem",
            padding: "0.5rem 0.65rem",
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            boxShadow: "var(--shadow-soft)",
            // Reset any typographic quirks inherited from the trigger (the
            // score badges use tabular-nums / uppercase / letter-spacing).
            fontSize: "0.8rem",
            fontWeight: 400,
            lineHeight: 1.4,
            letterSpacing: "normal",
            textTransform: "none",
            fontVariantNumeric: "normal",
            whiteSpace: "normal",
            textAlign: "left",
            // The bubble never needs to receive the pointer; letting events
            // pass through avoids flicker at the trigger's edge.
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
