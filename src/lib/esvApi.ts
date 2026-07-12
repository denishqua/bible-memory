// Thin client for the ESV Bible API's passage-text endpoint. Used by
// AddVerseForm to prefill reference/text ahead of the manual-entry path.
// See plan's "ESV API Integration" section — errors must be distinguishable
// by the caller (network vs. not-found vs. bad-API-key) so the UI can show a
// precise inline message while always leaving manual entry usable.

export type EsvApiErrorCode = "network" | "not-found" | "api-key" | "unknown";

export class EsvApiError extends Error {
  readonly code: EsvApiErrorCode;

  constructor(code: EsvApiErrorCode, message: string) {
    super(message);
    this.name = "EsvApiError";
    this.code = code;
  }
}

export interface EsvPassageResult {
  reference: string; // API's own "canonical" field, e.g. "Psalm 23:1–3"
  rawText: string; // uncleaned passages[0], still containing "[N]" verse markers etc.
}

const ESV_API_URL = "https://api.esv.org/v3/passage/text/";

interface EsvPassageResponse {
  canonical?: string;
  passages?: string[];
}

export async function fetchEsvPassage(query: string): Promise<EsvPassageResult> {
  const apiKey = import.meta.env.VITE_ESV_API_KEY as string | undefined;
  const params = new URLSearchParams({
    q: query,
    "include-verse-numbers": "true",
    "include-footnotes": "false",
    "include-headings": "false",
    "include-passage-references": "false",
  });

  let response: Response;
  try {
    response = await fetch(`${ESV_API_URL}?${params.toString()}`, {
      headers: { Authorization: `Token ${apiKey ?? ""}` },
    });
  } catch {
    throw new EsvApiError("network", "Couldn't reach the ESV API — check your connection and try again.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new EsvApiError("api-key", "ESV API key issue — the app's API key looks invalid or missing.");
  }

  if (!response.ok) {
    throw new EsvApiError("unknown", `ESV API returned an unexpected error (status ${response.status}).`);
  }

  let data: EsvPassageResponse;
  try {
    data = (await response.json()) as EsvPassageResponse;
  } catch {
    throw new EsvApiError("unknown", "Couldn't read the ESV API's response.");
  }

  if (!data.passages || data.passages.length === 0) {
    throw new EsvApiError("not-found", "Reference not found — check spelling or enter the verse manually.");
  }

  return {
    reference: data.canonical?.trim() || query.trim(),
    rawText: data.passages[0],
  };
}
