import React, { createContext, useContext, useState } from "react";
import type { Job } from "@/jobs/jobTypes";
import { loadJobs, saveJobs } from "@/jobs/jobStorage.web";
import { useAuth } from "@/context/AuthContext";
import { useGuardedLoad } from "@/lib/useGuardedLoad";

interface JobsContextType {
  jobs: Job[];
  loading: boolean;
  addJob: (job: Job) => Promise<void>;
  updateJob: (job: Job) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
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

  async function addJob(newJob: Job) {
    if (!guardSave()) return;
    const updated = [...jobs, newJob];
    setJobs(updated);
    // The person it's assigned to is told by the server, in their own bell.
    await saveJobs(updated);
  }

  async function updateJob(updatedJob: Job) {
    if (!guardSave()) return;
    const updated = jobs.map(j => (j.id === updatedJob.id ? updatedJob : j));
    setJobs(updated);
    await saveJobs(updated);
  }

  async function removeJob(id: string) {
    if (!guardSave()) return;
    const updated = jobs.filter(j => j.id !== id);
    setJobs(updated);
    await saveJobs(updated);
  }

  return (
    <JobsContext.Provider value={{ jobs, loading, addJob, updateJob, removeJob }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used inside JobsProvider");
  return ctx;
}
