// Staff-typed text (a lead's source, a car's make/model) ends up inside Pilot
// Brain's prompt and tool results. Two protections, applied here because this
// is the one place all of that text passes through:
//
//  1. Flatten it to one short plain line, so a stray line break can't start a
//     fake "instruction" section and a very long value can't crowd out the
//     real figures around it.
//  2. Neutralise text that reads like an instruction to the model ("ignore
//     your previous instructions", a fake "SYSTEM:" label, role tags, a
//     <remember> tag). It is replaced with a visible [filtered] marker, so a
//     person who typed it into a record can't turn that record into a way of
//     giving Pilot Brain orders.
//
// This is one layer of several. The stronger protection is that what Pilot
// Brain can do is limited by the person asking (see pilotBrainTabs and
// pilotBrainEdits), and the model is told that record text is data.

// Control characters (incl. tabs, newlines, NUL) plus the Unicode line and
// paragraph separators, and zero-width characters used to hide text.
const LINE_BREAKING = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;
const INVISIBLE = /\p{Cf}/gu; // format characters: zero-width spaces, direction marks, BOM

export const FILTERED = "[filtered]";

// Order matters little; each is replaced independently.
const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b[^.!?\n]{0,50}\b(instructions?|rules?|prompts?|guidelines?|directives?|restrictions?|programming|guardrails?|polic(?:y|ies))\b/gi,
  /\b(reveal|print|repeat|leak|dump|recite)\b[^.!?\n]{0,30}\b(prompt|instructions?|rules|configuration)\b/gi,
  /\byou are (now|no longer)\b/gi,
  /\bnew (instructions?|rules?|system prompt)\b/gi,
  /\b(system|assistant|developer)\s*(message|prompt)?\s*:/gi,
  /<\/?\s*(system|assistant|user|remember|tool_use|tool_result|function_calls?|instructions?)\b[^>]*>/gi,
  /<\|[^|>]*\|>/g,
  /\[\/?(?:INST|SYS)\]/gi,
  /```/g,
];

// True if the text contains anything the neutraliser would filter.
export function looksInjected(value: string): boolean {
  const flat = value.replace(INVISIBLE, "");
  return INJECTION_PATTERNS.some(p => {
    p.lastIndex = 0;
    return p.test(flat);
  });
}

function neutralise(value: string): string {
  let out = value;
  for (const p of INJECTION_PATTERNS) out = out.replace(p, FILTERED);
  return out;
}

// Counted and cut in whole characters, so an emoji is never left in half
// (half an emoji is not valid text).
function cap(flat: string, max: number): string {
  const chars = Array.from(flat);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : flat;
}

// Flatten only: for showing what someone actually typed to the owner (the
// security log), where filtering would hide the very thing being reported.
export function plainLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const flat = value.replace(INVISIBLE, "").replace(LINE_BREAKING, " ").replace(/\s+/g, " ").trim();
  return cap(flat, max);
}

// Flatten, neutralise, then cap: what goes into a prompt or a tool result.
export function oneLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const flat = neutralise(value.replace(INVISIBLE, "").replace(LINE_BREAKING, " ").replace(/\s+/g, " ").trim());
  return cap(flat, max);
}
