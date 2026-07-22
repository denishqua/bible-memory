import { useRef } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { sectionTitleStyle, helperTextStyle } from "./styles";
import { useDataBackup } from "../../hooks/useDataBackup";

export function DataBackupSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    importStatus,
    exported,
    clearArmed,
    setClearArmed,
    clearing,
    handleExport,
    handleImportFile,
    handleClearAll,
  } = useDataBackup();

  return (
    <Card>
      <h3 style={sectionTitleStyle}>Data</h3>
      <p style={{ ...helperTextStyle, marginBottom: "0.75rem" }}>
        Export everything (verses, collections, review history, verses practiced, settings) as a JSON
        backup, or restore from one. Restoring merges into your existing data — it never deletes
        anything.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <Button type="button" variant="secondary" onClick={handleExport}>
          Export data
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={importStatus.kind === "importing"}
        >
          {importStatus.kind === "importing" ? "Importing…" : "Import / Restore"}
        </Button>
        {exported ? (
          <span style={{ color: "var(--color-sage)", fontSize: "0.85rem" }}>Downloaded</span>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        style={{ display: "none" }}
      />
      {importStatus.kind === "done" ? (
        <p style={{ color: "var(--color-sage)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
          {importStatus.summary}
        </p>
      ) : null}
      {importStatus.kind === "error" ? (
        <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
          {importStatus.message}
        </p>
      ) : null}

      <div
        style={{
          marginTop: "1.25rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        {clearArmed ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ color: "var(--color-danger)", fontSize: "0.9rem", fontWeight: 600 }}>
              Really clear? This can’t be undone.
            </span>
            <Button type="button" variant="danger" onClick={handleClearAll} disabled={clearing}>
              {clearing ? "Clearing…" : "Yes, clear everything"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setClearArmed(false)} disabled={clearing}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="danger" onClick={() => setClearArmed(true)}>
            Clear all data
          </Button>
        )}
      </div>
    </Card>
  );
}
