import { authHeaders } from "@/lib/authToken";
import type { DiaryEntry } from "./diaryTypes";

const BASE_URL = "http://localhost:4001";

export async function loadDiaryEntries(): Promise<DiaryEntry[]> {
  try {
    const res = await fetch(`${BASE_URL}/diary`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadDiaryEntries: backend unreachable", err);
    return [];
  }
}

export async function addDiaryEntry(input: {
  date: string;
  text: string;
  isTask: boolean;
}): Promise<{ ok: boolean; error?: string; entry?: DiaryEntry }> {
  try {
    const res = await fetch(`${BASE_URL}/diary`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, entry: data.entry };
  } catch (err) {
    console.error("addDiaryEntry: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function updateDiaryEntry(
  id: string,
  patch: { text?: string; done?: boolean }
): Promise<{ ok: boolean; error?: string; entry?: DiaryEntry }> {
  try {
    const res = await fetch(`${BASE_URL}/diary/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, entry: data.entry };
  } catch (err) {
    console.error("updateDiaryEntry: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/diary/${id}`, { method: "DELETE", headers: authHeaders() });
  } catch (err) {
    console.error("deleteDiaryEntry: backend unreachable", err);
  }
}
