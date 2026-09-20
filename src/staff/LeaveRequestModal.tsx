import { useState } from "react";
import { usePlanner } from "@/context/PlannerContext";
import type { LeaveType } from "@/planner/plannerTypes";

interface LeaveRequestModalProps {
  onClose: () => void;
}

export default function LeaveRequestModal({ onClose }: LeaveRequestModalProps) {
  const { requestLeave } = usePlanner();
  const [type, setType] = useState<LeaveType>("holiday");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const invalidRange = Boolean(startDate && endDate && endDate < startDate);

  async function handleSubmit() {
    if (!startDate || !endDate || invalidRange) return;
    setSaving(true);
    setError(null);
    const err = await requestLeave({ type, startDate, endDate, ...(notes.trim() ? { notes: notes.trim() } : {}) });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-sm">
        <h2 className="text-white/80 text-xl font-semibold mb-4">Request Leave</h2>

        <label htmlFor="leaverequestmodal-type" className="text-white/60 text-sm">Type</label>
        <select id="leaverequestmodal-type"
          value={type}
          onChange={e => setType(e.target.value as LeaveType)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          <option value="holiday">Holiday (needs manager approval)</option>
          <option value="sick">Sick (logged immediately)</option>
          <option value="other">Other</option>
        </select>

        <label htmlFor="leaverequestmodal-start-date" className="text-white/60 text-sm">Start Date</label>
        <input id="leaverequestmodal-start-date"
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label htmlFor="leaverequestmodal-end-date" className="text-white/60 text-sm">End Date</label>
        <input id="leaverequestmodal-end-date"
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />
        {invalidRange && <p className="text-red-400 text-xs mb-4">End date can't be before start date.</p>}

        <label htmlFor="leaverequestmodal-notes-optional" className="text-white/60 text-sm">Notes (optional)</label>
        <textarea id="leaverequestmodal-notes-optional"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !startDate || !endDate || invalidRange}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-300"
          >
            {saving ? "..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
