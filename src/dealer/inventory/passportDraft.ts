// The dealer's editable copy of one car's Car Passport settings, and the small
// rules around editing it. The limits mirror the server's (engines/carPassport.ts
// there), which is what actually enforces them.

import type { PassportSettings } from "@/lib/carPassportApi";

export const MAX_LINES = 12;
export const MAX_LINE = 120;
export const MAX_NOTE = 300;

export type Draft = Omit<PassportSettings, "updatedAt">;

export function toDraft(s: PassportSettings): Draft {
  return {
    published: s.published,
    showReg: s.showReg,
    showMot: s.showMot,
    showUlez: s.showUlez,
    showMarket: s.showMarket,
    workDone: [...s.workDone],
    note: s.note,
  };
}

export function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.published === b.published &&
    a.showReg === b.showReg &&
    a.showMot === b.showMot &&
    a.showUlez === b.showUlez &&
    a.showMarket === b.showMarket &&
    a.note === b.note &&
    a.workDone.length === b.workDone.length &&
    a.workDone.every((line, i) => line === b.workDone[i])
  );
}

export type LineResult = { ok: true; draft: Draft } | { ok: false; error: string };

// Adds one line of work done, or says why not.
export function withLine(draft: Draft, raw: string): LineResult {
  const line = raw.replace(/\s+/g, " ").trim();
  if (line.length === 0) return { ok: false, error: "Type a line first." };
  if (line.length > MAX_LINE) return { ok: false, error: `Keep each line under ${MAX_LINE} characters.` };
  if (draft.workDone.length >= MAX_LINES) return { ok: false, error: `Up to ${MAX_LINES} lines.` };
  if (draft.workDone.some(l => l.toLowerCase() === line.toLowerCase())) return { ok: false, error: "That line is already there." };
  return { ok: true, draft: { ...draft, workDone: [...draft.workDone, line] } };
}

export function withoutLine(draft: Draft, index: number): Draft {
  return { ...draft, workDone: draft.workDone.filter((_, i) => i !== index) };
}

// Suggestions not already on the list.
export function remainingSuggestions(suggestions: string[], draft: Draft): string[] {
  const have = new Set(draft.workDone.map(l => l.toLowerCase()));
  return suggestions.filter(s => !have.has(s.toLowerCase()));
}

// The address buyers open, built from where the app is being used.
export function passportUrl(origin: string, dealershipId: string, vehicleId: string): string {
  return `${origin.replace(/\/+$/, "")}/car/${encodeURIComponent(dealershipId)}/${encodeURIComponent(vehicleId)}`;
}
