import React, { createContext, useContext, useState } from "react";
import type { Job } from "@/jobs/jobTypes";
import { loadJobs, saveJobs } from "@/jobs/jobStorage.web";
import { useAuth } from "@/context/AuthContext";
import { useGuardedLoad } from "@/lib/useGuardedLoad";

interface JobsContextType {
  jobs: Job[];
  loading: boolean;
  // Each resolves to false when nothing was saved; saveError says why.
  addJob: (job: Job) => Promise<boolean>;
  updateJob: (job: Job) => Promise<boolean>;
  removeJob: (id: string) => Promise<boolean>;
  saveError: string | null;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { user } = useAuth();

  // Keyed on the authenticated user's dealershipId, not `[]` — see
  // InventoryProvider/LeadsContext/StaffContext for the confirmed bug
  // a plain mount-once effect caused here: a real client-side login
  // never re-triggers it, leaving data stuck at whatever the brief
  // pre-login unauthenticated moment produced.
  //
  // Every write below replaces the server's WHOLE job list with what's
  // in memory, so guardSave() refuses until the jobs have loaded for
  // THIS login. Without it, one failed load followed by an ordinary
  // "add job" saved a one-job list over the dealer's real ones.
  const { loading, guardSave } = useGuardedLoad<Job[]>({
    id: "jobs",
    label: "jobs",
    key: user?.dealershipId,
    load: loadJobs,
    apply: setJobs,
    clear: () => setJobs([]),
  });

  // Each write re-reads the server's current list and saves it back with
  // the one change, like leads. Saving the list as it was when this screen
  // loaded quietly deleted any job a teammate had added since. A failed
  // re-read is never "no jobs": nothing is written.
  async function change(apply: (current: Job[]) => Job[]): Promise<boolean> {
    if (!guardSave()) return false;
    const current = await loadJobs();
    if (current === null) {
      setSaveError("Couldn't read the latest jobs, so nothing was saved. Please try again.");
      return false;
    }
    const updated = apply(current);
    const res = await saveJobs(updated);
    if (!res.ok) {
      setSaveError(res.error ?? "That couldn't be saved.");
      setJobs(current);
      return false;
    }
    setSaveError(null);
    setJobs(updated);
    return true;
  }

  // The person it's assigned to is told by the server, in their own bell.
  const addJob = (newJob: Job) => change(current => [...current, newJob]);
  const updateJob = (updatedJob: Job) => change(current => current.map(j => (j.id === updatedJob.id ? updatedJob : j)));
  const removeJob = (id: string) => change(current => current.filter(j => j.id !== id));

  return (
    <JobsContext.Provider value={{ jobs, loading, addJob, updateJob, removeJob, saveError }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used inside JobsProvider");
  return ctx;
}
