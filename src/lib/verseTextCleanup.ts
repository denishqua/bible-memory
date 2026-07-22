// Cleans raw ESV API passage text for storage/display. This module strips
// everything that should NOT survive into stored verse text:
//   - verse-number markers ("[N]"),
//   - footnote callouts/bodies,
//   - the API's own "(ESV)" translation suffix (translation is already
//     tracked separately on Verse.translation).
// We also request the API with include-verse-numbers=false, so the markers
// normally never appear; the strip here is defensive (and covers any verses
// pasted in from an older ESV response that still carried them).

// Defensive: strips a trailing "Footnotes\n\n..." body block. In practice we
// always call the API with include-footnotes=false so this block never
// appears, but stripping it if present costs nothing and matches the plan's
// explicit "strips footnote markers" requirement.
// Verse-number markers as the ESV API renders them, e.g. "[1] In the
// beginning". Strip the marker plus any following spaces/tabs (but not
// newlines, so poetry line breaks survive). A marker mid-line like
// "...day. [2] And..." collapses cleanly to "...day. And...".
const VERSE_NUMBER_MARKER_RE = /\[\d+\][ \t]*/g;

const FOOTNOTE_SECTION_RE = /\n+Footnotes\n+[\s\S]*$/;

// Defensive: strips inline footnote callouts glued directly onto a word,
// e.g. "leper(1)" -> "leper". Requires no preceding whitespace so a
// legitimate "(1)" standing alone in verse text is never touched.
const INLINE_FOOTNOTE_MARKER_RE = /(?<=\S)\(\d+\)/g;

// The ESV API appends a translation abbreviation like " (ESV)" at the very
// end of the passage text. Verse.translation already records this, so drop
// the suffix here rather than storing it twice.
const TRANSLATION_SUFFIX_RE = /\s*\([A-Z]{2,6}\)\s*$/;

export function cleanEsvText(rawText: string): string {
  const stripped = rawText
    .replace(FOOTNOTE_SECTION_RE, "")
    .replace(INLINE_FOOTNOTE_MARKER_RE, "")
    .replace(VERSE_NUMBER_MARKER_RE, "")
    .replace(TRANSLATION_SUFFIX_RE, "");

  // Preserve every real "\n" line break (poetry — never collapse to spaces),
  // just trim each line's leading/trailing whitespace, then trim the whole
  // result in case of leading/trailing blank lines.
  return stripped
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

// Collapse newlines to a single line so a verse preview truncates cleanly on one
// row. Shared by the Library and collection verse rows.
export function previewLine(text: string): string {
  return text.replace(/\n+/g, " ").trim();
}
