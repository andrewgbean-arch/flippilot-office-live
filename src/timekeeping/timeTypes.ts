export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  clockIn: string;
  clockOut: string | null;
}
