import type { DescentPhase } from "../../lib/verseDefenderEngine";

interface CannonProps {
  phase: DescentPhase;
  recoiling: boolean; // true for ~150ms right after a correct hit
}

const TIP_COLOR: Record<DescentPhase, string> = {
  "deep-space": "var(--color-sage)",
  "orbital-entry": "var(--color-clay)",
  crisis: "var(--color-danger)",
};

export function Cannon({ phase, recoiling }: CannonProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "8px",
        left: "50%",
        transform: recoiling
          ? "translateX(-50%) translateY(4px) scale(0.96)"
          : "translateX(-50%)",
        transition: "transform 0.12s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "10px",
          height: "26px",
          borderRadius: "5px 5px 0 0",
          background: "var(--color-ink-muted)",
          borderTop: `4px solid ${TIP_COLOR[phase]}`,
          transition: "border-color 0.3s ease",
        }}
      />
      <div
        style={{
          width: "44px",
          height: "20px",
          borderRadius: "22px 22px 0 0",
          background: "var(--color-ink)",
        }}
      />
    </div>
  );
}
