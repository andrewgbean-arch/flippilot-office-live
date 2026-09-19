// Staff-typed text (a lead's source, a car's make/model) ends up inside Pilot
// Brain's prompt. Flatten it to one short plain line first, so a stray line
// break can't start a fake "instruction" section and a very long value can't
// crowd out the real figures around it.

// Control characters (incl. tabs, newlines, NUL) plus the Unicode line and
// paragraph separators — anything that can break a line.
const LINE_BREAKING = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;

export function oneLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const flat = value.replace(LINE_BREAKING, " ").replace(/\s+/g, " ").trim();
  // Counted and cut in whole characters, so an emoji is never left in half
  // (half an emoji is not valid text).
  const chars = Array.from(flat);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : flat;
}
