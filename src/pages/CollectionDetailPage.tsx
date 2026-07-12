import { Link, useParams } from "react-router-dom";
import { CollectionDetail } from "../components/collections/CollectionDetail";

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div>
        <p style={{ color: "var(--color-ink-muted)" }}>Collection not found.</p>
        <Link to="/collections">Back to Collections</Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/collections"
        style={{
          display: "inline-block",
          marginBottom: "1.25rem",
          color: "var(--color-ink-muted)",
          fontSize: "0.9rem",
        }}
      >
        ← Back to Collections
      </Link>
      <CollectionDetail collectionId={id} />
    </div>
  );
}
