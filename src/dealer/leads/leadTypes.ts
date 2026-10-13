export type LeadStatus =
  | "new"
  | "contacted"
  | "viewing_booked"
  | "test_drive"
  | "negotiating"
  | "won"
  | "lost";

// How each status reads on screen. The stored value stays lower-case with an underscore.
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  viewing_booked: "Viewing Booked",
  test_drive: "Test Drive",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

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

  // Links this lead to a real vehicle in inventory (by id) so an
  // affordability check can be run against its real price — separate
  // from vehicleInterest, which stays free text since it predates this
  // and may not match a real stock item.
  interestedVehicleId?: string;

  // Buyer's real financial profile, entered by staff during a finance
  // conversation — feeds AffordabilityEngine (features/dealer-ai/AffordabilityEngine.ts).
  // All optional: a lead with none of these filled in just doesn't show
  // an affordability check yet, rather than showing a fabricated score.
  income?: number;
  expenses?: number;
  deposit?: number;
  creditScore?: number;
  savings?: number;
  employmentStability?: number;
};