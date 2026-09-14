export type AppointmentType = "viewing" | "test_drive";
export type AppointmentStatus = "pending" | "confirmed" | "declined" | "completed";

export interface Appointment {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
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
