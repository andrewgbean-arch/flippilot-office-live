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

export async function saveJobs(jobs: Job[]): Promise<void> {
  try {
    await fetch(`${BASE_URL}/jobs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items: jobs }),
    });
  } catch (err) {
    console.error("saveJobs: backend unreachable", err);
  }
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
