export type AppointmentType = "viewing" | "test_drive" | "mot";
export type AppointmentStatus = "pending" | "confirmed" | "declined" | "completed";

export interface Appointment {
  id: string;
  // Only set for "viewing"/"test_drive" — a real vehicle from this
  // dealership's own stock. An "mot" booking is the customer's own car,
  // not one the dealer is selling — see customerVehicleReg instead.
  vehicleId?: string;
  vehicleLabel: string;
  customerVehicleReg?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  type: AppointmentType;
  requestedDate: string;
  requestedTime: string;
  status: AppointmentStatus;
  notes?: string;
  leadId?: string;
  createdAt: string;
}
