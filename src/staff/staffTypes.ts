export type StaffRole = "manager" | "sales" | "admin" | "trainee" | "staff";

export type StaffRecord = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: StaffRole;
  branch?: string;
  joinedAt: string;
  lastActive?: string;
  active: boolean;
  permissions?: string[];
  nationalInsurance?: string;
  address?: string;
  skills?: string[];
  notes?: string;
};