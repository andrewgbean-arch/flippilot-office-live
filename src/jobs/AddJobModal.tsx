import React, { useState, useEffect } from "react";
import { useJobs } from "@/context/JobsContext";
import { useAuth } from "@/context/AuthContext";
import { loadTeam } from "./jobStorage.web";
import type { Job, JobPriority, TeamMember } from "./jobTypes";
import VehiclePicker from "@/bookkeeping/VehiclePicker";
import { useInventory } from "@/context/InventoryProvider";

interface AddJobModalProps {
  onClose: () => void;
}

export default function AddJobModal({ onClose }: AddJobModalProps) {
  const { addJob } = useJobs();
  const { user } = useAuth();
  const { vehicles } = useInventory();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<JobPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  useEffect(() => {
    loadTeam().then(members => {
      setTeam(members);
      setLoadingTeam(false);
    });
  }, []);

  function handleSave() {
    if (!title.trim()) return;

    const assignee = team.find(m => m.id === assignedToUserId);
    const vehicle = vehicleId ? vehicles.find(v => v.id === vehicleId) : undefined;

    const job: Job = {
      id: crypto.randomUUID(),
      title: title.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      status: "todo",
      assignedToUserId: assignee?.id ?? null,
      assignedToName: assignee?.name ?? null,
      vehicleId: vehicleId ?? null,
      vehicleLabel: vehicle ? `${vehicle.reg ? vehicle.reg + " — " : ""}${vehicle.make} ${vehicle.model}` : null,
      priority,
      dueDate: dueDate || null,
      createdAt: new Date().toISOString(),
      createdByName: user?.name ?? "Unknown",
    };

    addJob(job);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Add Job</h2>

        <label className="text-white/60 text-sm">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Book AB12 CDE in for MOT"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Vehicle (optional)</label>
        <VehiclePicker value={vehicleId} onChange={setVehicleId} />

        <label className="text-white/60 text-sm">Assign To</label>
        <select
          value={assignedToUserId}
          onChange={e => setAssignedToUserId(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="">{loadingTeam ? "Loading team…" : "Unassigned"}</option>
          {team.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} {m.role === "owner" ? "(Owner)" : m.staffRole ? `(${m.staffRole})` : ""}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-white/60 text-sm">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as JobPriority)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="text-white/60 text-sm">Due Date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className={`px-4 py-2 rounded font-semibold ${
              title.trim()
                ? "bg-yellow-500 text-black hover:bg-yellow-400"
                : "bg-gray-600 text-gray-300 cursor-not-allowed"
            }`}
          >
            Add Job
          </button>
        </div>
      </div>
    </div>
  );
}
