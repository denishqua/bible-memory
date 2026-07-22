import { useCallback, useState } from "react";

// Manages a deferred set of selected collection ids for the add/edit verse
// forms: toggle membership locally, and create-a-new-collection-then-select it.
// Membership is only persisted by the caller at submit time (except a
// newly-created collection, which is saved immediately so it can be selected).
// `createCollection` is injected (from useCollections) so this hook doesn't open
// a second subscription to collection storage.
export function useCollectionSelection(
  createCollection: (name: string) => Promise<{ id: string }>,
  initialIds?: string[],
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialIds ?? []));
  const [creating, setCreating] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Create a new collection and immediately select it. Guarded against re-entry
  // so a double-click can't create duplicates.
  const createAndSelect = useCallback(
    async (name: string) => {
      if (creating) return;
      setCreating(true);
      try {
        const collection = await createCollection(name);
        setSelectedIds((prev) => new Set(prev).add(collection.id));
      } finally {
        setCreating(false);
      }
    },
    [creating, createCollection],
  );

  return { selectedIds, setSelectedIds, toggle, createAndSelect, creating };
}
