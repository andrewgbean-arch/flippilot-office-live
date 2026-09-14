import { authHeaders } from "@/lib/authToken";
import type { Job, TeamMember } from "./jobTypes";

const BASE_URL = "http://localhost:4001";

export async function loadJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${BASE_URL}/jobs`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadJobs: backend unreachable", err);
    return [];
  }
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
