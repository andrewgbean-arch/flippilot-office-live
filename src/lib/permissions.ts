import type { AuthUser } from "@/context/AuthContext";

// Frontend mirror of the backend's rules (src/backend/src/roleAccess.ts and the
// requireStaffRole checks). Used to hide what someone can't open before a
// request is even sent, rather than letting them open a form and hit a raw 403
// on submit. The backend is still the real enforcement; this is purely UX.

// The Bookkeeping ledger, what each car cost and every profit figure: the
// owner, managers and finance. The server doesn't send the rest of the team
// any of it.
export function canSeeMoney(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  return user.staffRole === "finance" || user.staffRole === "manager";
}

// Writing the books is the same group as reading them.
export function canWriteBookkeeping(user: AuthUser | null): boolean {
  return canSeeMoney(user);
}

export function canManageStaff(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  return user.staffRole === "manager";
}

export function isOwner(user: AuthUser | null): boolean {
  return user?.role === "owner";
}

// Wanted Cars (the customers waiting for a car): sales, managers and the owner.
export function canSeeWanted(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  return user.staffRole === "sales" || user.staffRole === "manager";
}

// Taking a lead off the list: sales, managers and the owner (the server checks too).
export function canDeleteLeads(user: AuthUser | null): boolean {
  return canSeeWanted(user);
}

// Deleting a job: managers and the owner (the server checks too).
export function canDeleteJobs(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.role === "owner" || user.staffRole === "manager";
}
