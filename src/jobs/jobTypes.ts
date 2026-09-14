export type JobStatus = "todo" | "in_progress" | "done";
export type JobPriority = "low" | "medium" | "high";

export interface Job {
  id: string;
  title: string;
  notes?: string;
  status: JobStatus;

  // Real account id from /team — who this is assigned to, not the old
  // disconnected StaffRecord HR-directory entries.
  assignedToUserId?: string | null;
  assignedToName?: string | null;

  // Optional link to a specific vehicle — most day-to-day jobs at a
  // dealer are actually about a car ("book AB12CDE in for MOT").
  vehicleId?: string | null;
  vehicleLabel?: string | null;

  priority: JobPriority;
  dueDate?: string | null;

  // Workshop booking — separate from dueDate ("must be done by") since
  // this is "the actual day/time slot the car is booked into the
  // workshop for", a different thing a manager plans around a
  // physical bay rather than just a deadline. All optional: a job can
  // exist unscheduled and get slotted in later.
  scheduledDate?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  bay?: string | null;

  createdAt: string;
  createdByName: string;
  completedAt?: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "staff";
  staffRole?: "sales" | "finance" | "manager" | "general";
  dealershipId: string;
}
