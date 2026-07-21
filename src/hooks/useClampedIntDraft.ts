import { useEffect, useState } from "react";

// A free-typed whole-number field backed by a string draft. The user can clear
// and retype freely; the draft only commits on demand (blur / Enter). On commit
// the draft is floored to a whole number and must be finite and within
// [min, max] — a blank field, a non-finite value, or an out-of-range value all
// REVERT the draft to the stored value rather than committing. On a valid value
// the visible draft is normalized ("15.7" → "15") and the change is committed
// only when it actually differs from the stored value. The draft is re-seeded
// whenever the stored value changes (e.g. an imported-settings broadcast).
//
// Fields without an upper bound pass `max: Infinity` (parsed > Infinity is
// always false, so no value is ever rejected on the high end). The explicit
// blank check matters for fields whose `min` is 0: Number("") is 0, which would
// otherwise be a valid in-range value and silently commit on an empty input.
export function useClampedIntDraft(
  storedValue: number,
  opts: { min: number; max: number },
  commit: (value: number) => void,
) {
  const [draft, setDraft] = useState(String(storedValue));

  useEffect(() => {
    setDraft(String(storedValue));
  }, [storedValue]);

  function commitDraft() {
    const parsed = Math.floor(Number(draft));
    if (
      draft.trim() === "" ||
      !Number.isFinite(parsed) ||
      parsed < opts.min ||
      parsed > opts.max
    ) {
      setDraft(String(storedValue));
      return;
    }
    setDraft(String(parsed));
    if (parsed !== storedValue) commit(parsed);
  }

  return { draft, setDraft, commitDraft };
}
