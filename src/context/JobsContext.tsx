import React, { createContext, useContext, useState, useEffect } from "react";
import type { Job } from "@/jobs/jobTypes";
import { loadJobs, saveJobs } from "@/jobs/jobStorage.web";
import { useAuth } from "@/context/AuthContext";
import { useDealerNotifications } from "@/features/dealer-notifications/DealerNotificationsContext";

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
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { addNotification } = useDealerNotifications();

  // Keyed on the authenticated user's dealershipId, not `[]` — see
  // InventoryProvider/LeadsContext/StaffContext for the confirmed bug
  // a plain mount-once effect caused here: a real client-side login
  // never re-triggers it, leaving data stuck at whatever the brief
  // pre-login unauthenticated moment produced.
  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setJobs(await loadJobs());
      setLoading(false);
    })();
  }, [user?.dealershipId]);

  async function addJob(newJob: Job) {
    const updated = [...jobs, newJob];
    setJobs(updated);
    await saveJobs(updated);

    if (newJob.assignedToName) {
      addNotification({
        type: "info",
        title: "Job Assigned",
        message: `"${newJob.title}" assigned to ${newJob.assignedToName}.`,
      });
    }
  }

  async function updateJob(updatedJob: Job) {
    const updated = jobs.map(j => (j.id === updatedJob.id ? updatedJob : j));
    setJobs(updated);
    await saveJobs(updated);
  }

  async function removeJob(id: string) {
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
