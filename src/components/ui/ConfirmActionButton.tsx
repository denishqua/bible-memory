import { useState, type ReactNode } from "react";
import { Button } from "./Button";

interface ConfirmActionButtonProps {
  initialLabel?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  confirmVariant?: "primary" | "secondary" | "ghost" | "danger";
  onConfirm: () => void;
  style?: React.CSSProperties;
}

export function ConfirmActionButton({
  initialLabel = "Delete",
  confirmLabel = "Confirm Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  confirmVariant = "danger",
  onConfirm,
  style,
}: ConfirmActionButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", ...style }}>
        <Button
          variant={confirmVariant}
          onClick={() => {
            onConfirm();
            setConfirming(false);
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          {cancelLabel}
        </Button>
      </div>
    );
  }

  return (
    <Button variant={variant} onClick={() => setConfirming(true)} style={style}>
      {initialLabel}
    </Button>
  );
}
