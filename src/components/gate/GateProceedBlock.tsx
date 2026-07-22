import { Button } from "../ui/Button";

interface GateProceedBlockProps {
  targetUrl: string | null;
  targetHost: string | null;
  onProceed: () => void;
}

export function GateProceedBlock({ targetUrl, targetHost, onProceed }: GateProceedBlockProps) {
  return (
    <>
      <Button variant="primary" onClick={onProceed} style={{ fontSize: "1rem", padding: "0.65rem 1.5rem" }}>
        {targetUrl ? "Proceed to site →" : "Done"}
      </Button>
      {targetHost && (
        <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem", marginTop: "0.6rem" }}>
          {targetHost}
        </p>
      )}
    </>
  );
}
