import { useState } from "react";
import type { Collection } from "../../types/collection";
import { Button } from "../ui/Button";

export interface CollectionSelectorProps {
  collections: Collection[];
  selectedCollectionIds: Set<string>;
  onToggleCollection: (collectionId: string) => void;
  onCreateCollection: (name: string) => Promise<string | void>;
  inputStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}

export function CollectionSelector({
  collections,
  selectedCollectionIds,
  onToggleCollection,
  onCreateCollection,
  inputStyle,
  labelStyle,
}: CollectionSelectorProps) {
  const [newCollectionName, setNewCollectionName] = useState("");

  const handleCreateCollection = async () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    await onCreateCollection(trimmed);
    setNewCollectionName("");
  };

  return (
    <div>
      <label style={labelStyle}>
        Collections <span style={{ opacity: 0.7 }}>(optional)</span>
      </label>
      {collections.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            marginBottom: "0.6rem",
            maxHeight: "10rem",
            overflowY: "auto",
          }}
        >
          {collections.map((collection) => (
            <label
              key={collection.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              <input
                type="checkbox"
                checked={selectedCollectionIds.has(collection.id)}
                onChange={() => onToggleCollection(collection.id)}
              />
              {collection.name}
            </label>
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreateCollection();
            }
          }}
          placeholder="New collection name"
          style={{ flex: 1, ...inputStyle }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleCreateCollection()}
        >
          Create
        </Button>
      </div>
    </div>
  );
}
