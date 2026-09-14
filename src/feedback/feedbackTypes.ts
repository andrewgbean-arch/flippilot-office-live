export type FeedbackStatus = "new" | "reviewed" | "actioned";

export interface FeedbackEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
}
