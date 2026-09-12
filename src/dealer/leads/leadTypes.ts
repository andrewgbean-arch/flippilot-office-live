export type LeadStatus =
  | "new"
  | "contacted"
  | "viewing_booked"
  | "test_drive"
  | "negotiating"
  | "won"
  | "lost";

export type Lead = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  source: string;
  vehicleInterest?: string;
  status: LeadStatus;
  score?: number;
  notes?: string;
  createdAt: string;
};