// Text that did not come from the dealership's own team: what a stranger types
// into the public booking form, and what comes back from the live web. It is
// stored, shown to staff, and (a little of it) handed to Pilot Brain, so it is
// cleaned in ONE place, here, rather than by every caller in its own way.
//
// Two levels, on purpose:
//  - toSingleLine / toMultiLine keep the text as the person wrote it, minus
//    anything that can break layout (control characters, line breaks where a
//    single line is wanted, invisible direction-flipping marks) and capped in
//    length. This is what gets STORED.
//  - toPromptLine goes further, for anything about to be put inside a
//    sentence Pilot Brain reads: it also removes link, image, Markdown and
//    HTML syntax and web addresses, so the text is left as plain words.
//
// Nothing here can make hostile text "safe to obey" — the model is separately
// told that this kind of text is data, never instructions. What it does is
// make sure the text is short, one line, and carries no way to draw a picture
// or a link.

// Character classes are built from code-point numbers rather than typed in, so
// the invisible and control characters they describe never sit in this file.
function charClass(ranges: ReadonlyArray<readonly [number, number]>): RegExp {
  const body = ranges
    .map(([from, to]) => String.fromCharCode(from) + (to > from ? "-" + String.fromCharCode(to) : ""))
    .join("");
  return new RegExp("[" + body + "]", "g");
}

// Line breaks, tabs and every other control character (incl. the Unicode line
// and paragraph separators). Turned into a space so words don't run together.
const CONTROL_CHARS = charClass([[0x00, 0x1f], [0x7f, 0x9f], [0x2028, 0x2029]]);

// Control characters other than the plain line feed (0x0a), for text that may
// keep its line breaks.
const CONTROL_CHARS_EXCEPT_LF = charClass([[0x00, 0x09], [0x0b, 0x1f], [0x7f, 0x9f]]);

// Every kind of line break other than CR+LF, folded into a plain line feed.
const OTHER_LINE_BREAKS = charClass([[0x0d, 0x0d], [0x85, 0x85], [0x2028, 0x2029]]);

// Invisible characters that hide text or flip its direction: soft hyphen,
// Arabic letter mark, Mongolian vowel separator, zero-width and directional
// marks, bidi embeddings/overrides/isolates, invisible operators, the byte
// order mark and the interlinear-annotation marks. Removed outright.
const INVISIBLE_CHARS = charClass([
  [0xad, 0xad],
  [0x61c, 0x61c],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
]);

// Cut on whole characters, so an emoji or accented letter is never split in
// half by the limit.
function truncateChars(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join("").trimEnd();
}

// Bounds the work done on absurdly large input before any pattern runs on it.
function bounded(input: unknown, max: number): string {
  return typeof input === "string" ? input.slice(0, Math.max(max * 8, 400)) : "";
}

// One line, no control or invisible characters, at most `max` characters.
// Not a string (or nothing left after cleaning) gives "".
export function toSingleLine(input: unknown, max: number): string {
  const cleaned = bounded(input, max)
    .replace(CONTROL_CHARS, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
  return truncateChars(cleaned, max);
}

// Free text that may run to a few lines (a customer's note): line breaks are
// kept (at most one blank line in a row), everything else as toSingleLine.
export function toMultiLine(input: unknown, max: number): string {
  const cleaned = bounded(input, max)
    .replace(/\r\n/g, "\n")
    .replace(OTHER_LINE_BREAKS, "\n")
    .replace(CONTROL_CHARS_EXCEPT_LF, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return truncateChars(cleaned, max);
}

// Markdown / HTML characters that could form a link, an image, a heading, a
// list, a quote or a tag. Turned into spaces (the words either side survive).
const MARKUP_CHARS = /[[\]()<>`*_~#|\\{}!]/g;

// The default length for a person's name inside a Pilot Brain sentence.
export const PROMPT_NAME_CHARS = 60;

// For text that is about to be placed inside a sentence Pilot Brain reads: one
// short line of plain words. Image and link syntax keeps only its visible
// label, web addresses and script-style schemes are removed, and any leftover
// Markdown or HTML characters become spaces.
export function toPromptLine(input: unknown, max: number = PROMPT_NAME_CHARS): string {
  const cleaned = bounded(input, max)
    .replace(CONTROL_CHARS, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\b(?:https?:\/\/|(?:javascript|vbscript|data|file|mailto):)\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(MARKUP_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return truncateChars(cleaned, max);
}
