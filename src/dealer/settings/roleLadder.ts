// Which way a change of staff role goes, for the Manage Team screen.
//
// This is a copy of the ladder the SERVER uses to decide when a role change
// cancels every invite link already shared (STAFF_ROLE_LEVEL and
// isStaffRoleDemotion in src/backend/src/auth.ts). The screen needs its own
// copy so it can ask the owner BEFORE making a change that has that side
// effect: the server only reports afterwards, and a cancelled link can't be
// brought back by changing the role back.
//
// Two copies of a rule can drift apart, so roleChangeTable.json lists every
// from -> to move with the answer it must give, and BOTH this file's test and
// the backend's inviteRevocation.test.ts read that one file. Change either
// ladder without the other (or the table) and one of the two tests fails.

export type StaffRole = "sales" | "finance" | "manager" | "general";

// Where each role sits, lowest to highest — the same numbers as the server.
// Used for ONE decision only: telling a step down from a step up or no change.
const ROLE_LEVEL: Record<StaffRole, number> = {
  general: 0,
  sales: 1,
  finance: 2,
  manager: 3,
};

// The roles from lowest to highest (the order of the table above).
export const STAFF_ROLES_LOW_TO_HIGH: readonly StaffRole[] = (Object.keys(ROLE_LEVEL) as StaffRole[]).sort(
  (a, b) => ROLE_LEVEL[a] - ROLE_LEVEL[b]
);

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ROLE_LEVEL, value);
}

// True when moving from `from` to `to` is a step DOWN. An account with no
// staffRole at all counts as general, as it does on the server.
export function isRoleDemotion(from: StaffRole | undefined, to: StaffRole): boolean {
  return ROLE_LEVEL[to] < ROLE_LEVEL[from ?? "general"];
}

// What the role dropdown should do when the owner picks `chosen` for someone
// whose role is `from`:
//   "ignore"  - nothing to do (not a real role, or it's the role they already have)
//   "apply"   - a step up: make the change straight away
//   "confirm" - a step down: ask first, because it also cancels every invite
//               link already shared
export type RoleChangeStep = "ignore" | "apply" | "confirm";

export function roleChangeStep(from: StaffRole | undefined, chosen: string): RoleChangeStep {
  if (!isStaffRole(chosen)) return "ignore";
  if (chosen === (from ?? "general")) return "ignore";
  return isRoleDemotion(from, chosen) ? "confirm" : "apply";
}
