import { Link } from "react-router-dom";
import type { Collection } from "../../types/collection";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ConfirmActionButton } from "../ui/ConfirmActionButton";

interface CollectionCardProps {
  collection: Collection;
  verseCount: number;
  onDelete: (id: string) => void;
}

export function CollectionCard({ collection, verseCount, onDelete }: CollectionCardProps) {
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
        <ConfirmActionButton
          initialLabel="Delete"
          modalTitle="Delete Collection"
          modalMessage={`Are you sure you want to delete "${collection.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => onDelete(collection.id)}
        />
      </div>
    </Card>
  );
}
