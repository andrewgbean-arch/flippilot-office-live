export interface DiaryEntry {
  id: string;
  userId: string;
  date: string; // yyyy-mm-dd
  text: string;
  isTask: boolean;
  done: boolean;
  createdAt: string;
}
