import { useState } from "react";
import { Link } from "react-router-dom";
import type { Collection } from "../../types/collection";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

interface CollectionCardProps {
  collection: Collection;
  verseCount: number;
  onDelete: (id: string) => void;
}

export function CollectionCard({ collection, verseCount, onDelete }: CollectionCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <Link to={`/collections/${collection.id}`} style={{ textDecoration: "none" }}>
          <h3 style={{ fontSize: "1.1rem" }}>{collection.name}</h3>
        </Link>
        <p style={{ color: "var(--color-ink-muted)", fontSize: "0.85rem", marginTop: "0.3rem" }}>
          {verseCount} {verseCount === 1 ? "verse" : "verses"}
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <Link to={`/collections/${collection.id}`} style={{ textDecoration: "none" }}>
          <Button variant="ghost">Open</Button>
        </Link>
        {confirmingDelete ? (
          <>
            <Button
              variant="danger"
              onClick={() => {
                onDelete(collection.id);
                setConfirmingDelete(false);
              }}
            >
              Confirm Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
