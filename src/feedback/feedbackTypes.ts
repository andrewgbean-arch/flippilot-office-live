import type { MessagePhoto } from "@/lib/messagePhotosApi";

export type FeedbackStatus = "new" | "reviewed" | "actioned";

export interface FeedbackEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  // Empty for a post that's only photos.
  message: string;
  // Signed links that expire after 24 hours and are re-issued on every fetch,
  // so they're shown as they arrive and never kept.
  photos?: MessagePhoto[];
  status: FeedbackStatus;
  createdAt: string;
}
