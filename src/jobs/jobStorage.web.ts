import { authHeaders } from "@/lib/authToken";
import { loadList } from "@/lib/loadJson";
import type { Job, TeamMember } from "./jobTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

// null = the jobs couldn't be read (dropped connection, 401/402/403/5xx,
// not a list). [] only ever means the server said there are none. Every
// save replaces the whole list, so treating a failed read as "no jobs"
// meant the next save wiped the real ones (see loadJson.ts).
export async function loadJobs(): Promise<Job[] | null> {
  return loadList<Job>("/jobs");
}

// Says whether the server kept it: a refused save (for example removing a
// lead or job without the right role) must not look like it worked.
export interface SaveResult { ok: boolean; error?: string }

async function putList(path: string, items: unknown[]): Promise<SaveResult> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: typeof data.error === "string" ? data.error : "That couldn't be saved. Please try again." };
  } catch {
    return { ok: false, error: "Couldn't reach FlipPilot, so that wasn't saved. Please try again." };
  }
}

export async function saveJobs(jobs: Job[]): Promise<SaveResult> {
  return putList("/jobs", jobs);
}

// The real team to assign jobs to — distinct from useStaff()'s
// StaffRecord list, which is a separate HR-directory-style collection
// never linked to a real login account at all.
export async function loadTeam(): Promise<TeamMember[]> {
  try {
    const res = await fetch(`${BASE_URL}/team`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.members) ? data.members : [];
  } catch (err) {
    console.error("loadTeam: backend unreachable", err);
    return [];
  }
}
