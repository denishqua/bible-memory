// Cleans raw ESV API passage text for storage/display. Per spec-review fix #4
// (see the plan's "Fixes From Spec Review"), verse-number markers are kept —
// never stripped — because tokenize.ts already treats a standalone "[N]"
// (see the VERSE_NUMBER_RE convention documented there) as a non-matchable,
// display-only context token. The ESV API's own text output already renders
// verse numbers in exactly that "[N]" form (confirmed against a live
// response), so no reformatting of the markers themselves is needed here —
// this module only strips what should NOT survive into storage:
// footnote callouts/bodies and the API's own "(ESV)" translation suffix
// (translation is already tracked separately on Verse.translation).

// Defensive: strips a trailing "Footnotes\n\n..." body block. In practice we
// always call the API with include-footnotes=false so this block never
// appears, but stripping it if present costs nothing and matches the plan's
// explicit "strips footnote markers" requirement.
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
