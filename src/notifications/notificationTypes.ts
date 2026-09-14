export type NotificationType = "info" | "success" | "warning" | "error";

export interface StaffNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
}
