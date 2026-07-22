import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Card } from "./Card";

interface ModalDialogProps {
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  cardStyle?: CSSProperties;
  backdropStyle?: CSSProperties;
}

export function ModalDialog({
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  cardStyle,
  backdropStyle,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape key handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus trapping inside the modal
  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;

    // Focus the first focusable element or the dialog card itself
    const focusableElements = dialogEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusableElements[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }

    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    dialogEl.addEventListener("keydown", handleTabKey);
    return () => dialogEl.removeEventListener("keydown", handleTabKey);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
        ...backdropStyle,
      }}
      onClick={onClose}
    >
      <div ref={dialogRef} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "34rem" }}>
        <Card style={cardStyle}>{children}</Card>
      </div>
    </div>
  );
}
