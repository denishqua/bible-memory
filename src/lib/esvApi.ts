const ESV_API_URL = 'https://api.esv.org/v3/passage/text/';

export interface EsvFetchResult {
  reference: string;
  text: string;
}

/** Fetches a passage's plain text from Crossway's ESV API, given a free-text reference like "John 3:16". */
export async function fetchEsvPassage(reference: string): Promise<EsvFetchResult> {
  const apiKey = import.meta.env.VITE_ESV_API_KEY;
  if (!apiKey) {
    throw new Error('ESV API key is not configured (set VITE_ESV_API_KEY in .env.local).');
  }

  const url = new URL(ESV_API_URL);
  url.searchParams.set('q', reference);
  url.searchParams.set('include-passage-references', 'false');
  url.searchParams.set('include-verse-numbers', 'false');
  url.searchParams.set('include-footnotes', 'false');
  url.searchParams.set('include-headings', 'false');
  url.searchParams.set('include-short-copyright', 'false');
  url.searchParams.set('include-selahs', 'false');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Token ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`ESV API request failed (${res.status}).`);
  }

  const data = await res.json();
  const passage: string | undefined = data.passages?.[0];
  if (!passage || !passage.trim()) {
    throw new Error(`No passage found for "${reference}". Check the reference and try again.`);
  }

  return {
    reference: data.canonical ?? reference,
    text: passage.trim(),
  };
}
