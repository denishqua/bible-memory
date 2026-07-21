import { tokenize, type Token } from "./tokenize";
import type { Verse } from "../types/verse";

/**
 * Given an array of collection IDs and a lookup function mapping a collection ID to its verse IDs,
 * returns a deduplicated array of verse IDs preserving collection order.
 */
export function resolveCollectionVerseIds(
  collectionIds: string[],
  getVerseIdsForCollection: (collectionId: string) => string[]
): string[] {
  const seen = new Set<string>();
  const verseIds: string[] = [];
  for (const collectionId of collectionIds) {
    for (const vId of getVerseIdsForCollection(collectionId)) {
      if (!seen.has(vId)) {
        seen.add(vId);
        verseIds.push(vId);
      }
    }
  }
  return verseIds;
}

/**
 * Given an array of verse IDs and the full list of saved verses,
 * returns the matching Verse objects in order.
 */
export function resolveCollectionVerses(
  verseIds: string[],
  verses: Verse[]
): Verse[] {
  const verseMap = new Map(verses.map((v) => [v.id, v]));
  return verseIds.map((id) => verseMap.get(id)).filter((v): v is Verse => Boolean(v));
}

/**
 * Given an array of verses in a collection, tokenizes each verse and inserts
 * between-verse reference delimiters so a collection review runs as a single stream.
 */
export function buildCollectionReviewTokens(verses: Verse[]): Token[] {
  const tokens: Token[] = [];
  verses.forEach((verse, i) => {
    tokens.push(...tokenize(verse.text));
    if (i < verses.length - 1) {
      tokens.push({ raw: "\n", matchable: false, normalized: "", isLineBreak: true });
      tokens.push({
        raw: `— ${verse.reference} —`,
        matchable: false,
        normalized: "",
        isReference: true,
        isReferenceDelimiter: true,
      });
      tokens.push({ raw: "\n", matchable: false, normalized: "", isLineBreak: true });
    }
  });
  return tokens;
}
