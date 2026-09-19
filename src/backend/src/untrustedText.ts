// Text that did not come from the dealership's own team: what a stranger types
// into the public booking form, and what comes back from the live web. It is
// stored, shown to staff, and (a little of it) handed to Pilot Brain, so it is
// cleaned in ONE place, here, rather than by every caller in its own way.
//
// Two levels, on purpose:
//  - toSingleLine / toMultiLine keep the text as the person wrote it, minus
//    anything that can break layout (control characters, line breaks where a
//    single line is wanted, invisible characters that hide text or flip its
//    direction) and capped in length. This is what gets STORED. Zero-width
//    joiners are kept here: real spellings need them.
//  - toPromptLine goes further, for anything about to be put inside a
//    sentence Pilot Brain reads: it also removes link, image, Markdown and
//    HTML syntax and web addresses, and keeps only letters, marks, numbers,
//    punctuation, symbols and spaces, so the text is left as plain words.
//
// Nothing here can make hostile text "safe to obey" — the model is separately
// told that this kind of text is data, never instructions. What it does is
// make sure the text is short, one line, and carries no way to draw a picture
// or a link.

// Character classes are built from code-point numbers rather than typed in, so
// the invisible and control characters they describe never sit in this file.
// (The "u" flag matters: several of these characters lie beyond U+FFFF, and
// without it a class would see each of them as two unrelated halves.)
function codePoint(n: number): string {
  return "\\u{" + n.toString(16) + "}";
}
function charClass(ranges: ReadonlyArray<readonly [number, number]>): RegExp {
  const body = ranges
    .map(([from, to]) => codePoint(from) + (to > from ? "-" + codePoint(to) : ""))
    .join("");
  return new RegExp("[" + body + "]", "gu");
}

// Line breaks, tabs and every other control character (incl. the Unicode line
// and paragraph separators). Turned into a space so words don't run together.
const CONTROL_CHARS = charClass([[0x00, 0x1f], [0x7f, 0x9f], [0x2028, 0x2029]]);

// Control characters other than the plain line feed (0x0a), for text that may
// keep its line breaks.
const CONTROL_CHARS_EXCEPT_LF = charClass([[0x00, 0x09], [0x0b, 0x1f], [0x7f, 0x9f]]);

// Every kind of line break other than CR+LF, folded into a plain line feed.
const OTHER_LINE_BREAKS = charClass([[0x0d, 0x0d], [0x85, 0x85], [0x2028, 0x2029]]);

// Invisible characters that hide text or flip its direction. The important ones
// are the Unicode "Tags" block (U+E0000-E007F: each is an invisible copy of an
// ASCII letter, so a whole sentence can ride along inside a name without
// anyone seeing it) and the variation selectors, which are invisible too. The
// rest: soft hyphen,
// Arabic letter mark, Mongolian vowel separator, zero-width and directional
// marks, bidi embeddings/overrides/isolates, invisible operators, the byte
// order mark and the interlinear-annotation marks, and the "filler" characters
// (Hangul, Braille) that draw nothing. Removed outright.
//
// NOT in this list, on purpose: the zero-width non-joiner (U+200C) and joiner
// (U+200D). They are part of how real names are spelt (Persian, Sinhala,
// Malayalam) and of emoji sequences, so stored text keeps them. They are only
// dropped from text going to the model — see toPromptLine.
const INVISIBLE_CHARS = charClass([
  [0xad, 0xad], // soft hyphen
  [0x34f, 0x34f], // combining grapheme joiner
  [0x61c, 0x61c], // Arabic letter mark
  [0x115f, 0x1160], // Hangul fillers
  [0x17b4, 0x17b5], // Khmer inherent vowels (invisible)
  [0x180b, 0x180f], // Mongolian variation selectors and vowel separator
  [0x200b, 0x200b], // zero-width space
  [0x200e, 0x200f], // left-to-right and right-to-left marks
  [0x202a, 0x202e], // bidi embeddings and overrides
  [0x2060, 0x206f], // word joiner, invisible operators, bidi isolates
  [0x2800, 0x2800], // Braille blank
  [0x3164, 0x3164], // Hangul filler
  [0xfe00, 0xfe0f], // variation selectors
  [0xfeff, 0xfeff], // byte order mark
  [0xffa0, 0xffa0], // half-width Hangul filler
  [0xfff0, 0xfffc], // annotation marks, and the object-replacement character
  [0x1bca0, 0x1bca3], // shorthand format controls
  [0x1d173, 0x1d17a], // musical format controls
  [0xe0000, 0xe0fff], // Tags block, variation selectors supplement, rest of the ignorable range
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

// The joiners are kept in stored text (see the list above), which leaves one
// way to sneak in a name that shows as nothing at all: a "name" made only of
// them. Text with nothing else in it counts as empty.
const ONLY_JOINERS = /^[\u{200c}\u{200d}\s]*$/u;
function dropIfOnlyJoiners(text: string): string {
  return ONLY_JOINERS.test(text) ? "" : text;
}

// One line, no control or invisible characters, at most `max` characters.
// Not a string (or nothing left after cleaning) gives "".
export function toSingleLine(input: unknown, max: number): string {
  const cleaned = bounded(input, max)
    .replace(CONTROL_CHARS, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
  return truncateChars(dropIfOnlyJoiners(cleaned), max);
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
  return truncateChars(dropIfOnlyJoiners(cleaned), max);
}

// Markdown / HTML characters that could form a link, an image, a heading, a
// list, a quote or a tag. Turned into spaces (the words either side survive).
const MARKUP_CHARS = /[[\]()<>`*_~#|\\{}!]/g;

// The default length for a person's name inside a Pilot Brain sentence.
export const PROMPT_NAME_CHARS = 60;

// What Pilot Brain is allowed to be shown of a stranger's words: letters, marks,
// numbers, punctuation, symbols and ordinary spaces. This is an allow-list, not
// yet another list of things to remove, so everything else goes — invisible
// format characters of every kind (this is where the zero-width joiner and
// non-joiner are dropped), private-use and unassigned code points, stray halves
// of an emoji — including anything that gets invented after this was written.
const NOT_PLAIN_TEXT = /[^\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}]/gu;

// The first stage for any text that is about to go to the model: control
// characters become spaces, then hidden characters and everything outside the
// allow-list are dropped. It runs BEFORE the look for links and markup, so
// that nothing hidden can sit inside "https" and stop it being recognised.
function plainCharacters(input: unknown, max: number): string {
  return bounded(input, max)
    .replace(CONTROL_CHARS, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(NOT_PLAIN_TEXT, "");
}

// For text that is about to be placed inside a sentence Pilot Brain reads: one
// short line of plain words. Image and link syntax keeps only its visible
// label, web addresses and script-style schemes are removed, and any leftover
// Markdown or HTML characters become spaces.
export function toPromptLine(input: unknown, max: number = PROMPT_NAME_CHARS): string {
  const cleaned = plainCharacters(input, max)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\b(?:https?:\/\/|(?:javascript|vbscript|data|file|mailto):)\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(MARKUP_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return truncateChars(cleaned, max);
}
