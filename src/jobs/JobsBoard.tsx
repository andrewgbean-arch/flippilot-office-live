import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "@/context/JobsContext";
import type { Job, JobStatus } from "./jobTypes";
import AddJobModal from "./AddJobModal";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import GoldButton from "@/components/ui/GoldButton.web";

const COLUMNS: { status: JobStatus; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

const PRIORITY_COLOR: Record<string, string> = {
  low: "text-white/50",
  medium: "text-yellow-300",
  high: "text-red-400",
};

function JobCard({ job }: { job: Job }) {
  const { updateJob, removeJob } = useJobs();
  const navigate = useNavigate();

  function move(status: JobStatus) {
    updateJob({
      ...job,
      status,
      completedAt: status === "done" ? new Date().toISOString() : null,
    });
  }

  const isOverdue =
    job.dueDate && job.status !== "done" && new Date(job.dueDate).getTime() < Date.now();

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg p-3 mb-3">
      <div className="flex justify-between items-start gap-2">
        <p className="text-white/90 font-semibold text-sm">{job.title}</p>
        <span className={`text-xs font-bold uppercase ${PRIORITY_COLOR[job.priority]}`}>
          {job.priority}
        </span>
      </div>

      {job.notes && <p className="text-white/50 text-xs mt-1">{job.notes}</p>}

      {job.vehicleId && (
        <button
          onClick={() => navigate(`/dealer/inventory/${job.vehicleId}`)}
          className="text-yellow-300/80 text-xs mt-2 hover:underline"
        >
          🚗 {job.vehicleLabel}
        </button>
      )}

      <div className="flex justify-between items-center mt-3 text-xs">
        <span className="text-white/50">
          {job.assignedToName ? `👤 ${job.assignedToName}` : "Unassigned"}
        </span>
        {job.dueDate && (
          <span className={isOverdue ? "text-red-400 font-semibold" : "text-white/40"}>
            {isOverdue ? "Overdue: " : "Due "}
            {new Date(job.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        {COLUMNS.filter(c => c.status !== job.status).map(c => (
          <button
            key={c.status}
            onClick={() => move(c.status)}
            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/60"
          >
            → {c.label}
          </button>
        ))}
        <button
          onClick={() => removeJob(job.id)}
          className="text-xs px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function JobsBoard() {
  const { jobs, loading } = useJobs();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-10 animate-fadeIn">
      <SupernovaHeroHeader
        title="Jobs Board"
        subtitle="Day-to-day tasks for your team — MOTs to book, cars to prep, calls to make."
      />

      <div className="flex justify-end max-w-6xl mx-auto mt-6 mb-6">
        <GoldButton onPress={() => setShowAddModal(true)}>Add Job</GoldButton>
      </div>

      <SupernovaSectionDivider label="Board" />

      {loading ? (
        <p className="text-white/60 text-center mt-10">Loading jobs…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-6">
          {COLUMNS.map(col => {
            const colJobs = jobs.filter(j => j.status === col.status);
            return (
              <SupernovaGlowCard key={col.status}>
                <h2 className="text-yellow-300 font-bold text-lg mb-4 flex justify-between items-center">
                  {col.label}
                  <span className="text-white/40 text-sm font-normal">{colJobs.length}</span>
                </h2>

                {colJobs.length === 0 ? (
                  <p className="text-white/40 text-sm">Nothing here.</p>
                ) : (
                  colJobs
                    .slice()
                    .reverse()
                    .map(job => <JobCard key={job.id} job={job} />)
                )}
              </SupernovaGlowCard>
            );
          })}
        </div>
      )}

      {showAddModal && <AddJobModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
