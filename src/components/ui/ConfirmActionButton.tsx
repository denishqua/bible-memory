import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { ModalDialog } from "./ModalDialog";

interface ConfirmActionButtonProps {
  initialLabel?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  modalTitle?: string;
  modalMessage?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  confirmVariant?: "primary" | "secondary" | "ghost" | "danger";
  onConfirm: () => void;
  style?: React.CSSProperties;
}

export function ConfirmActionButton({
  initialLabel = "Delete",
  confirmLabel = "Confirm Delete",
  cancelLabel = "Cancel",
  modalTitle = "Confirm Delete",
  modalMessage = "Are you sure you want to delete this? This action cannot be undone.",
  variant = "danger",
  confirmVariant = "danger",
  onConfirm,
  style,
}: ConfirmActionButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setShowModal(true)} style={style}>
        {initialLabel}
      </Button>

      {showModal && (
        <ModalDialog
          onClose={() => setShowModal(false)}
          ariaLabel={modalTitle}
          cardStyle={{
            maxWidth: "26rem",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div>
            <h3 style={{ marginBottom: "0.5rem", fontSize: "1.15rem", fontWeight: 600 }}>{modalTitle}</h3>
            <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              {modalMessage}
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={() => {
                onConfirm();
                setShowModal(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </ModalDialog>
      )}
    </>
  );
}
