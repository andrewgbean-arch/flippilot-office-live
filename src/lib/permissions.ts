import type { AuthUser } from "@/context/AuthContext";

// Frontend mirror of the backend's requireStaffRole checks (auth.ts) —
// used to disable/hide write actions before a request is even sent,
// rather than letting someone open a form and hit a raw 403 on submit.
// The backend is still the real enforcement; this is purely UX.
export function canWriteBookkeeping(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  return user.staffRole === "finance" || user.staffRole === "manager";
}

export function canManageStaff(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  return user.staffRole === "manager";
}
