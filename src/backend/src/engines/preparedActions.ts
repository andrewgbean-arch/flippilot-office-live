// The Operations screen holds the changes Pilot Brain has prepared for an
// owner or manager to approve. This gives it a one-line view of that queue,
// so it can say "you have three things waiting for you" instead of leaving
// Boss to remember to look.
//
// Counts by kind only. A prepared action carries a customer's name and a
// drafted message, and none of that goes to the model.

export const PREPARED_ACTIONS_COLLECTION = "pilotBrainActions";

export interface QueuedAction {
  type?: unknown;
  status?: unknown;
}

const KIND_LABELS: [string, string, string][] = [
  ["lead_followup", "lead follow-up draft", "lead follow-up drafts"],
  ["appointment_followup", "appointment follow-up draft", "appointment follow-up drafts"],
  ["bookkeeping_categorize", "bookkeeping categorisation", "bookkeeping categorisations"],
  ["rota_shift", "rota shift suggestion", "rota shift suggestions"],
];

export function summarisePreparedActions(actions: QueuedAction[]): string[] {
  const waiting = actions.filter(a => typeof a === "object" && a !== null && a.status === "prepared");
  if (waiting.length === 0) {
    return ["Prepared actions waiting for approval in Operations: none."];
  }

  const parts: string[] = [];
  let known = 0;
  for (const [type, one, many] of KIND_LABELS) {
    const n = waiting.filter(a => a.type === type).length;
    known += n;
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  }
  const other = waiting.length - known;
  if (other > 0) parts.push(`${other} other`);

  return [
    `Prepared actions waiting for an owner or manager to approve in Operations: ${waiting.length} (${parts.join(", ")}).`,
  ];
}
