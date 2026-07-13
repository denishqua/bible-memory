import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useStorage } from "../data/storageContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { Verse } from "../types/verse";
import type { Collection, CollectionVerseLink } from "../types/collection";

// One-time "starter pack" importer. Fetches a bundled payload and writes it
// through the active StorageAdapter — so it lands in localStorage when opened
// in a normal browser tab, or in chrome.storage.local when opened inside the
// extension. Idempotent: re-running once the collection exists is a no-op.
interface ImportPayload {
  collectionId: string;
  collectionName: string;
  collectionCreatedAt: string;
  verses: Verse[];
  links: CollectionVerseLink[];
}

type Status =
  | { kind: "idle" }
  | { kind: "importing"; done: number; total: number }
  | { kind: "done"; count: number; name: string }
  | { kind: "already"; name: string }
  | { kind: "error"; message: string };

export function ImportPage() {
  const storage = useStorage();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const runImport = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}starter-100-verses.json`);
      if (!res.ok) throw new Error(`Couldn't load the starter file (${res.status}).`);
      const payload = (await res.json()) as ImportPayload;

      const collections = await storage.getCollections();
      if (collections.some((c) => c.id === payload.collectionId)) {
        setStatus({ kind: "already", name: payload.collectionName });
        return;
      }

      const total = payload.verses.length + payload.links.length + 1;
      let done = 0;
      const tick = () => {
        done += 1;
        setStatus({ kind: "importing", done, total });
      };

      const collection: Collection = {
        id: payload.collectionId,
        name: payload.collectionName,
        createdAt: payload.collectionCreatedAt,
      };
      await storage.saveCollection(collection);
      tick();

      for (const verse of payload.verses) {
        await storage.saveVerse(verse);
        tick();
      }
      for (const link of payload.links) {
        await storage.addVerseToCollection(link);
        tick();
      }

      setStatus({ kind: "done", count: payload.verses.length, name: payload.collectionName });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }, [storage]);

  return (
    <Card style={{ maxWidth: "32rem", margin: "2rem auto", textAlign: "center" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>Import starter verses</h2>
      <p style={{ color: "var(--color-ink-muted)", marginBottom: "1.25rem" }}>
        Adds the “100 Verses” collection (167 verses) to this app’s storage.
      </p>

      {status.kind === "idle" && (
        <Button variant="primary" onClick={runImport}>
          Import 100 Verses
        </Button>
      )}

      {status.kind === "importing" && (
        <p style={{ color: "var(--color-ink-muted)" }}>
          Importing… {status.done} / {status.total}
        </p>
      )}

      {status.kind === "done" && (
        <div>
          <p style={{ marginBottom: "1rem" }}>
            Imported “{status.name}” — {status.count} verses.
          </p>
          <Link to="/collections">Go to Collections</Link>
        </div>
      )}

      {status.kind === "already" && (
        <div>
          <p style={{ marginBottom: "1rem" }}>“{status.name}” is already imported.</p>
          <Link to="/collections">Go to Collections</Link>
        </div>
      )}

      {status.kind === "error" && (
        <p style={{ color: "var(--color-danger)" }}>{status.message}</p>
      )}
    </Card>
  );
}
