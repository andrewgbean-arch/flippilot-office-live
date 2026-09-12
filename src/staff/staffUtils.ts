import { StaffRecord } from "./staffTypes";

export function getActiveStaff(staff: StaffRecord[]) {
  return staff.filter(s => s.active);
}

export function getStaffByRole(staff: StaffRecord[], role: string) {
  return staff.filter(s => s.role === role);
}

export function getBranchStaff(staff: StaffRecord[], branch: string) {
  return staff.filter(s => s.branch === branch);
}
